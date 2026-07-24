"""Tests del motor de predicción (lógica + endpoint FastAPI)."""
import pytest
from fastapi.testclient import TestClient

from model.predict import predecir_descarte
import api


def test_categoria_desconocida_rechazada():
    with pytest.raises(ValueError):
        predecir_descarte({"producto": "Sandía", "destino": "España",
                           "precio_mp_kg": 4.2, "mes": 5})


def test_destino_desconocido_rechazado():
    with pytest.raises(ValueError):
        predecir_descarte({"producto": "Palta Hass", "destino": "Japón",
                           "precio_mp_kg": 4.2, "mes": 5})


def test_descarte_en_rango():
    r = predecir_descarte({"producto": "Palta Hass", "destino": "España",
                           "precio_mp_kg": 4.2, "mes": 5})
    assert 0.0 <= r["porcentaje_descarte"] <= 1.0


def test_endpoint_predict_api_key_invalida():
    client = TestClient(api.app)
    res = client.post(
        "/predict",
        headers={"X-Internal-Key": "clave-incorrecta"},
        json={"producto": "Palta Hass", "destino": "España",
              "precio_mp_kg": 4.2, "mes": 5},
    )
    assert res.status_code == 401


def test_endpoint_predict_ok_con_api_key_valida():
    client = TestClient(api.app)
    res = client.post(
        "/predict",
        headers={"X-Internal-Key": "secreto-solo-para-tests"},
        json={"producto": "Palta Hass", "destino": "España",
              "precio_mp_kg": 4.2, "mes": 5},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert 0.0 <= body["porcentaje_descarte"] <= 1.0


def test_endpoint_categorias_devuelve_clases_entrenadas():
    client = TestClient(api.app)
    res = client.get("/categorias", headers={"X-Internal-Key": "secreto-solo-para-tests"})
    assert res.status_code == 200
    body = res.json()
    assert "Palta Hass" in body["producto"]
    assert "España" in body["destino"]


def test_endpoint_categorias_api_key_invalida():
    client = TestClient(api.app)
    res = client.get("/categorias", headers={"X-Internal-Key": "clave-incorrecta"})
    assert res.status_code == 401
