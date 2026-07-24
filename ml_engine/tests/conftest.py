"""Fixtures compartidas: inyecta un modelo mínimo en el caché de predict
para que los tests no dependan del .pkl entrenado (ignorado en git)."""
import os

import numpy as np
import pytest
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import LabelEncoder

os.environ.setdefault("ML_INTERNAL_SECRET", "secreto-solo-para-tests")

from model import predict as predict_module  # noqa: E402


@pytest.fixture(autouse=True)
def modelo_de_prueba():
    """Modelo lineal trivial entrenado con las categorías reales del proyecto."""
    le_producto = LabelEncoder().fit(["Palta Hass", "Palta Fuerte", "Mandarina Malvacea"])
    le_destino = LabelEncoder().fit(["España", "EE.UU.", "México", "Países Bajos"])

    X = np.array([[0, 0, 4.2, 1], [1, 1, 4.5, 5], [2, 2, 3.8, 9], [0, 3, 5.0, 12]])
    y = np.array([0.10, 0.12, 0.15, 0.11])
    model = LinearRegression().fit(X, y)

    predict_module._cache["payload"] = {
        "model": model,
        "encoders": {"producto": le_producto, "destino": le_destino},
        "classes": {"producto": le_producto.classes_, "destino": le_destino.classes_},
        "features": ["producto", "destino", "precio_mp_kg", "mes"],
        "mae": 0.005,
        "r2": 0.97,
        "model_name": "Test Linear",
    }
    yield
    predict_module._cache.clear()
