# Contexto de build: la RAÍZ del repo (el seed lee ml_engine/data/cotizaciones.csv)
# node:22 (Debian completo): los engines de Prisma requieren OpenSSL del sistema
# (no funcionan en Alpine/musl y la imagen slim no trae libssl)
FROM node:22

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./
COPY ml_engine/data/ /app/ml_engine/data/

RUN npx prisma generate

EXPOSE 5000
# Migraciones siempre; el seed (usuarios demo + dataset de entrenamiento)
# SOLO corre si RUN_SEED=true — evita que un despliegue de producción reciba
# cuentas demo automáticas en cada arranque del contenedor. Activarlo
# únicamente para la demo/tesis (ver credentials.md para las contraseñas).
CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"$RUN_SEED\" = \"true\" ]; then npx prisma db seed; fi && node server.js"]
