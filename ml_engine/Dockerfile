FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Incluye model/modelo_rf.pkl si existe en el contexto de build
# (si no existe, entrenar con: docker compose exec ml_engine python model/train.py)
COPY . .

EXPOSE 8000
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
