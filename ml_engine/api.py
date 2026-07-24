import os
from fastapi import FastAPI, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field

# Importamos la lógica de inferencia
from model.predict import predecir_descarte, _load_model

api_key_header = APIKeyHeader(name="X-Internal-Key", auto_error=False)

def verify_api_key(api_key: str = Security(api_key_header)):
    secret = os.getenv("ML_INTERNAL_SECRET")
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ML_INTERNAL_SECRET not configured on server"
        )
    if api_key != secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid internal API key"
        )

app = FastAPI(
    title="Frutransport ML Engine",
    description="Motor predictivo de porcentaje de descarte",
    version="2.0.0",
    dependencies=[Security(verify_api_key)]
)

# Sin CORS: este servicio solo recibe tráfico servidor-a-servidor desde el
# backend Express (autenticado con X-Internal-Key); nunca desde un navegador.

# ── Schemas de entrada / salida ──────────────────────────────────────────────

class CotizacionInput(BaseModel):
    """Datos de entrada para la predicción de porcentaje de descarte."""
    producto:     str   = Field(..., example="Palta Hass")
    destino:      str   = Field(..., example="España")
    precio_mp_kg: float = Field(..., gt=0, example=4.20)
    mes:          int   = Field(..., ge=1, le=12, example=5)

class PrediccionOutput(BaseModel):
    ok:                  bool
    porcentaje_descarte: float
    mae:                 float
    r2:                  float
    modelo_nombre:       str


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Verifica que el servicio y el modelo estén operativos."""
    try:
        payload = _load_model()
        return {
            "status":       "ok",
            "service":      "Frutransport ML Engine",
            "modelo":       payload.get("model_name", "desconocido"),
            "mae":          round(payload.get("mae", 0), 4),
            "r2":           round(payload.get("r2", 0), 4),
            "model_loaded": True,
        }
    except FileNotFoundError as e:
        return {"status": "degraded", "error": str(e), "model_loaded": False}


@app.get("/categorias")
def categorias():
    """
    Categorías de producto/destino con las que el modelo fue entrenado
    (LabelEncoder.classes_). El backend lo expone en GET /api/ml/categorias
    para que el ERP marque qué entradas del catálogo (Producto/Destino) aún
    no tienen datos de entrenamiento — el modelo rechaza cualquier otra.
    """
    try:
        payload = _load_model()
        classes = payload.get("classes", {})
        return {
            "producto": sorted(classes.get("producto", []).tolist()) if "producto" in classes else [],
            "destino":  sorted(classes.get("destino", []).tolist()) if "destino" in classes else [],
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/predict", response_model=PrediccionOutput)
def predict(data: CotizacionInput):
    """
    Recibe los parámetros base de una cotización y devuelve el porcentaje de descarte.
    """
    try:
        resultado = predecir_descarte(data.model_dump())
        return PrediccionOutput(
            ok=True,
            **resultado
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
