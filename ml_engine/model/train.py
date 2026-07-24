import os
import sys
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
import pandas as pd
import numpy as np
from sqlalchemy import create_engine
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import joblib

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'modelo_rf.pkl')

# 2. NUEVA VARIABLE OBJETIVO (Verdad Empírica)
TARGET = 'porcentaje_descarte_real'

# 3. REDUCCIÓN DE DIMENSIONALIDAD (Features)
FEATURES = ['producto', 'destino', 'precio_mp_kg', 'mes']


def load_and_prepare():
    # 1. EXTRACCIÓN DIRECTA (Cero Data Leakage)
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL no está configurada en las variables de entorno.")
    
    # Asegurar que el dialecto de SQLAlchemy sea correcto (postgresql://)
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    # 'schema' es un parámetro exclusivo de Prisma; psycopg2 lo rechaza
    parsed = urlsplit(database_url)
    query = urlencode([(k, v) for k, v in parse_qsl(parsed.query) if k != "schema"])
    database_url = urlunsplit(parsed._replace(query=query))

    engine = create_engine(database_url)
    
    print("Extrayendo datos de operaciones liquidadas desde PostgreSQL...")
    query = """
        SELECT * FROM cotizaciones 
        WHERE estado = 'LIQUIDADA' 
        AND porcentaje_descarte_real IS NOT NULL
    """
    df = pd.read_sql(query, engine)
    
    # Verificar columnas necesarias
    # (Nota: Asumimos que precio_mp_kg u otras variables existen en la tabla o vista subyacente)
    required_cols = ['producto', 'destino', 'precio_mp_kg', 'creado_en', TARGET]
    for col in required_cols:
        if col not in df.columns:
            raise KeyError(f"La columna requerida '{col}' no se encuentra en la extracción de base de datos.")
            
    # Extraer el mes dinámicamente de la fecha de creación
    df['creado_en'] = pd.to_datetime(df['creado_en'])
    df['mes'] = df['creado_en'].dt.month
    
    X = df[FEATURES].copy()
    y = df[TARGET].copy()
    
    # Limpiar posibles NAs en X
    X = X.dropna()
    y = y.loc[X.index]
    
    # 4. CONTROL DE ANOMALÍAS EN CATEGORÍAS
    encoders = {}
    for col in ['producto', 'destino']:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col].astype(str))
        encoders[col] = le
        
    return X, y, encoders


def optimize_and_evaluate(name, model, param_grid, X_train, X_test, y_train, y_test):
    # 5. OPTIMIZACIÓN DE HIPERPARÁMETROS basado en MAE
    grid_search = GridSearchCV(
        estimator=model,
        param_grid=param_grid,
        scoring='neg_mean_absolute_error',
        cv=5,
        n_jobs=-1
    )
    grid_search.fit(X_train, y_train)
    
    best_model = grid_search.best_estimator_
    y_pred = best_model.predict(X_test)
    
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print(f"\n{'='*40}")
    print(f"  {name}")
    print(f"{'='*40}")
    print(f"  Mejores hiperparámetros: {grid_search.best_params_}")
    print(f"  RMSE : {rmse:.4f}")
    print(f"  MAE  : {mae:.4f}")
    print(f"  R²   : {r2:.4f}")
    
    return best_model, rmse, mae, r2


def train():
    print("Iniciando pipeline de entrenamiento para porcentaje_descarte...")
    X, y, encoders = load_and_prepare()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Configurar grillas de hiperparámetros (profundidad máxima limitada)
    rf = RandomForestRegressor(random_state=42)
    rf_params = {
        'n_estimators': [100, 200],
        'max_depth': [3, 5, 7],
        'min_samples_split': [2, 5, 10]
    }

    gb = GradientBoostingRegressor(random_state=42)
    gb_params = {
        'n_estimators': [100, 200],
        'learning_rate': [0.01, 0.05, 0.1],
        'max_depth': [2, 3, 4]
    }

    rf_model, rf_rmse, rf_mae, rf_r2 = optimize_and_evaluate(
        'Random Forest', rf, rf_params, X_train, X_test, y_train, y_test)
    
    gb_model, gb_rmse, gb_mae, gb_r2 = optimize_and_evaluate(
        'Gradient Boosting', gb, gb_params, X_train, X_test, y_train, y_test)

    print("\n" + "="*40)
    # Seleccionamos el mejor modelo minimizando el MAE
    if rf_mae <= gb_mae:
        best_model = rf_model
        best_name = 'Random Forest'
        best_mae = rf_mae
        best_r2 = rf_r2
    else:
        best_model = gb_model
        best_name = 'Gradient Boosting'
        best_mae = gb_mae
        best_r2 = gb_r2

    print(f"  Mejor modelo global: {best_name} (MAE={best_mae:.4f})")

    # Reentrenar el mejor modelo sobre todo el dataset (X, y)
    best_model.fit(X, y)

    # 4. Guardar clases explícitamente en el payload
    payload = {
        'model': best_model,
        'encoders': encoders,
        'classes': {col: le.classes_ for col, le in encoders.items()},
        'features': FEATURES,
        'r2': best_r2,
        'mae': best_mae,
        'model_name': best_name,
    }
    joblib.dump(payload, MODEL_PATH)
    print(f"\n  Modelo guardado en: {MODEL_PATH}")
    print("  Entrenamiento completado exitosamente.")


if __name__ == '__main__':
    # Cargar variable de entorno DATABASE_URL si existe un archivo .env en el backend
    try:
        from dotenv import load_dotenv
        env_path = os.path.join(BASE_DIR, '..', '..', 'backend', '.env')
        if os.path.exists(env_path):
            load_dotenv(env_path)
    except ImportError:
        pass
    
    train()
