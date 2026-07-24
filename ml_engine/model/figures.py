"""Genera las figuras de la tesis desde el modelo entrenado (modelo_rf.pkl).

Salidas (en ml_engine/model/):
  - feature_importance.png : importancia relativa de variables
  - pred_vs_real.png       : predicho vs real sobre el split de test de train.py

Uso:  python model/figures.py  (requiere DATABASE_URL, igual que train.py)
"""
import os

try:
    from dotenv import load_dotenv
    _env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "backend", ".env")
    if os.path.exists(_env_path):
        load_dotenv(_env_path)
except ImportError:
    pass

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split

from train import load_and_prepare

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "modelo_rf.pkl")

payload = joblib.load(MODEL_PATH)
model, features = payload["model"], payload["features"]

# ── Fig 1: importancia de variables ─────────────────────────────────────────
importancias = model.feature_importances_
plt.figure(figsize=(7, 4))
plt.barh(features, importancias, color="#2F5496")
plt.xlabel("Importancia relativa")
plt.title(f"Importancia de variables — {payload['model_name']}")
plt.tight_layout()
ruta_fi = os.path.join(BASE_DIR, "feature_importance.png")
plt.savefig(ruta_fi, dpi=200)
print(f"Figura guardada: {ruta_fi}")

# ── Fig 2: predicho vs real (mismo split que train.py) ──────────────────────
X, y, _ = load_and_prepare()
_, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
y_pred = model.predict(X_test)

plt.figure(figsize=(6, 6))
plt.scatter(y_test, y_pred, color="#2F5496", alpha=0.7, edgecolors="white")
lims = [min(y_test.min(), y_pred.min()), max(y_test.max(), y_pred.max())]
plt.plot(lims, lims, "--", color="#C00000", linewidth=1, label="Predicción perfecta")
plt.xlabel("Descarte real")
plt.ylabel("Descarte predicho")
plt.title(f"Predicho vs Real — {payload['model_name']} (MAE={payload['mae']:.4f})")
plt.legend()
plt.tight_layout()
ruta_pr = os.path.join(BASE_DIR, "pred_vs_real.png")
plt.savefig(ruta_pr, dpi=200)
print(f"Figura guardada: {ruta_pr}")
