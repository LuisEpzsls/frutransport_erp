import os
import joblib
import pandas as pd

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'modelo_rf.pkl')

_cache = {}

def _load_model():
    if 'payload' not in _cache:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Modelo no encontrado en {MODEL_PATH}. "
                "Ejecute: python model/train.py"
            )
        _cache['payload'] = joblib.load(MODEL_PATH)
    return _cache['payload']

def predecir_descarte(datos_dict: dict) -> dict:
    payload = _load_model()
    model = payload['model']
    encoders = payload['encoders']
    classes = payload.get('classes', {})
    features = payload['features']
    mae = payload.get('mae', 0.0)
    r2 = payload.get('r2', 0.0)
    nombre = payload.get('model_name', "Desconocido")

    row = {}
    
    # 2. RECHAZO DE CATEGORÍAS DESCONOCIDAS
    for col, le in encoders.items():
        val = str(datos_dict.get(col, ''))
        conocidas = classes.get(col, le.classes_)
        if val not in conocidas:
            raise ValueError(f"Categoría no reconocida para '{col}': {val}")
        
        row[col] = le.transform([val])[0]

    for f in features:
        if f not in row:
            row[f] = float(datos_dict.get(f, 0))

    X = pd.DataFrame([row])[features]
    
    # Predicción del porcentaje de descarte
    descarte_estimado = float(model.predict(X)[0])
    
    # Aseguramos que el descarte esté entre 0 y 1
    descarte_estimado = max(0.0, min(1.0, descarte_estimado))

    return {
        'porcentaje_descarte': round(descarte_estimado, 4),
        'mae': round(mae, 4),
        'r2': round(r2, 4),
        'modelo_nombre': nombre
    }
