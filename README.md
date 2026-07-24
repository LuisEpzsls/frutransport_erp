  # Frutransport — ERP + Landing Page + ML Engine

Sistema integral para una empresa peruana de agroexportación y logística multimodal. Comprende una **landing page pública multiidioma**, un **ERP interno con RBAC**, y un **motor de predicción de porcentaje de descarte basado en Machine Learning** que alimenta el cálculo determinístico del costo total de un contenedor de exportación.

> Proyecto de tesis. Estado: **desarrollo funcional completo** — ver §15 Pendientes conocidos para lo que falta antes de la defensa.

---

## Índice

1. [Finalidad del proyecto](#1-finalidad-del-proyecto)
2. [Arquitectura general](#2-arquitectura-general)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Estructura del repositorio](#4-estructura-del-repositorio)
5. [Modos de arranque](#5-modos-de-arranque)
6. [Variables de entorno](#6-variables-de-entorno)
7. [Base de datos](#7-base-de-datos)
8. [API REST — Endpoints](#8-api-rest--endpoints)
9. [Motor ML — Implementación detallada](#9-motor-ml--implementación-detallada)
10. [Frontend — Pantallas del ERP](#10-frontend--pantallas-del-erp)
11. [Roles y acceso ERP](#11-roles-y-acceso-erp)
12. [Rubros, control de usuarios y notificaciones](#12-rubros-control-de-usuarios-y-notificaciones)
13. [Seguridad](#13-seguridad)
14. [Tests y CI](#14-tests-y-ci)
15. [Pendientes conocidos](#15-pendientes-conocidos)

---

## 1. Finalidad del proyecto

Frutransport opera en seis divisiones: agroexportación, importaciones, servicios automotrices, logística y mudanzas, transporte pesado y telecomunicaciones. El sistema cubre tres capas:

| Capa | Audiencia | Propósito |
|---|---|---|
| **Landing page** | Clientes internacionales | Presentar catálogo, recibir registros de nuevos importadores |
| **ERP interno** | Personal (ADMIN / MANAGER / AUDITOR) | Cotizar con predicción ML, liquidar operaciones, auditar historial |
| **ML Engine** | Gestores de cotización | Predecir el **% de descarte** de la fruta antes de comprar la materia prima |

El cuello de botella que resuelve el ML es la **estimación del descarte** (merma de fruta no exportable): es la variable de mayor incertidumbre al cotizar. El modelo la predice desde el histórico de operaciones liquidadas; el costo total se calcula después de forma **determinística** (contabilidad, no ML) a partir de ese descarte.

### Ciclo de vida de una cotización

```
PENDIENTE ──(opcional: APROBADA → EN_TRANSITO)──▶ LIQUIDADA
    │                                                  │
    │ creada con porcentaje_descarte_ESTIMADO          │ se registran descarte y costo REALES
    │ y costo_total_ESTIMADO (predicción ML)           │ → nueva muestra de entrenamiento
    └── RECHAZADA                                      └── train.py lee WHERE estado='LIQUIDADA'
```

Cada liquidación produce un dato real nuevo → el reentrenamiento periódico mejora el modelo con la operación del negocio (círculo virtuoso, sin data leakage: solo se entrena con valores reales, nunca con estimados).

---

## 2. Arquitectura general

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE / BROWSER                        │
│               React 19 + Vite 8 + Tailwind 4  (:5173)           │
│         (en Docker: nginx :8080 sirve build + proxy /api)       │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP /api/* (JWT Bearer)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (API Gateway)  :5000                 │
│              Node.js 22 + Express 4 + Prisma 5                   │
│                                                                  │
│  /api/auth           login vs PostgreSQL (bcrypt) + /me          │
│  /api/cotizaciones   listar/crear/liquidar (zod + RBAC)          │
│  /api/ml             proxy autenticado → ML Engine               │
│  helmet · rate-limit login · corte de riesgo descarte ≥ 60%      │
└──────────────┬──────────────────────────┬────────────────────────┘
               │ Prisma                    │ fetch + X-Internal-Key
               ▼                           ▼
┌──────────────────────┐    ┌─────────────────────────────────────┐
│   PostgreSQL  :5432   │    │        ML ENGINE  :8000              │
│                       │    │  Python 3.12+ · FastAPI · uvicorn    │
│  • usuarios           │    │                                      │
│  • clientes           │    │  POST /predict → % descarte          │
│  • cotizaciones ◀─────┼────│  GET  /health  → modelo/MAE/R²       │
│  • departamentos      │ train.py lee LIQUIDADA                   │
└──────────────────────┘    │  modelo_rf.pkl (modelo+encoders+     │
                             │  métricas, caché en memoria)         │
                             └─────────────────────────────────────┘
```

### Flujo de una predicción (en vivo desde el formulario)

```
Usuario (ADMIN/MANAGER) escribe → debounce 500 ms → POST /api/ml/predict (JWT)
  Backend:
    1. zod valida los 10 campos (rangos)
    2. POST /predict al motor (solo 4 features: producto, destino, precio_mp_kg, mes)
       con header X-Internal-Key
    3. Si descarte >= 0.60 → HTTP 400 (bloqueo de riesgo, advertencia en UI)
    4. Cálculo determinístico del costo total + desglose (MP, maquila, flete,
       agenciamiento, SLI) usando el descarte predicho
    5. Respuesta incluye `cotizacion_sugerida`: payload listo para
       POST /api/cotizaciones sin recalcular nada
  Frontend muestra: costo total, desglose, % descarte, modelo, MAE y latencia
  real medida con performance.now()
```

---

## 3. Stack tecnológico

### Frontend
| Herramienta | Versión | Rol |
|---|---|---|
| React | 19.x | UI declarativa, SPA |
| Vite | 8.x | Bundler, HMR, proxy `/api` → :5000 en dev |
| TailwindCSS | 4.x | Utilidades CSS (paleta slate `#0f172a` + acento verde `#22c55e`) |
| React Router DOM | 7.x | Routing por rol con lazy loading (un chunk por zona) |
| Axios | 1.x | Cliente HTTP con interceptores (JWT + logout en 401) |

### Backend
| Herramienta | Versión | Rol |
|---|---|---|
| Node.js | 22.x | Runtime |
| Express | 4.x | Framework HTTP |
| Prisma | 5.x | ORM + migraciones (8 migraciones) |
| PostgreSQL | 16+ | Base de datos relacional |
| jsonwebtoken | 9.x | Autenticación stateless (8h) |
| bcryptjs | 3.x | Hash de contraseñas (cost=10) |
| zod | 4.x | Validación de entrada (predict + cotizaciones) |
| helmet / express-rate-limit | 8.x | Endurecimiento HTTP |

### ML Engine
| Herramienta | Versión | Rol |
|---|---|---|
| Python | 3.12+ | Runtime (`.venv/` en la raíz del repo) |
| FastAPI | ≥0.111 | API con auth por `X-Internal-Key` |
| uvicorn | ≥0.30 | Servidor ASGI |
| scikit-learn | ≥1.5 | RandomForest / GradientBoosting + GridSearchCV |
| pandas / numpy / joblib | — | Datos y serialización |
| SQLAlchemy + psycopg2 | ≥2.0 | Lectura de PostgreSQL en train.py |
| matplotlib | ≥3.9 | Figuras para la tesis (figures.py) |

### Infraestructura
- **Monorepo** — tres servicios aislados + carpeta `database/`
- **Docker Compose** — 4 servicios para la demo (`postgres`, `ml_engine`, `backend`, `frontend`)
- **GitHub Actions** — jobs `pytest` + `jest` en cada push (`.github/workflows/ci.yml`)

---

## 4. Estructura del repositorio

```
FrutransportCode/
├── frontend/                       # React SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProtectedRoute.jsx  # guardia por rol (user.role vs allowedRoles)
│   │   │   ├── TablaCotizaciones.jsx # tabla paginada + modal de liquidación (reutilizable)
│   │   │   └── ...                 # Header, Hero, Sidebar, ERPLoginModal, etc.
│   │   ├── context/                # AuthContext (ROLES, login/logout), I18nContext (ES/EN/PT/ZH)
│   │   ├── layouts/                # AdminLayout, AuditorLayout, ClientLayout
│   │   ├── pages/
│   │   │   ├── admin/              # MLCotizaciones (cotizador ML), Historial, Reportes*
│   │   │   ├── auditor/            # Historial (solo lectura), Reportes*
│   │   │   ├── cliente/            # Cotizaciones*            (* = stub pendiente)
│   │   │   ├── Login.jsx           # redirige por rol (HOME_BY_ROLE)
│   │   │   └── LandingPage / Dashboard / Unauthorized
│   │   └── services/api.js         # Axios: baseURL /api, JWT, 401 → /login
│   ├── Dockerfile                  # build Vite → nginx
│   ├── nginx.conf                  # proxy /api → backend:5000 + SPA fallback
│   └── vite.config.js              # proxy dev /api → :5000
│
├── backend/                        # Express API
│   ├── config/ml.js                # ML_ENGINE_URL + ML_INTERNAL_SECRET
│   ├── controllers/
│   │   ├── mlController.js         # zod → motor ML → corte 60% → costo determinístico
│   │   └── cotizacionesController.js # listar/crear/liquidar con zod + Prisma
│   ├── middleware/auth.js          # verifyToken (JWT) + requireRole(...roles)
│   ├── routes/                     # auth.js, ml.js, cotizaciones.js
│   ├── prisma/
│   │   ├── schema.prisma           # Usuario, Cliente, Cotizacion, Departamento + enums
│   │   ├── migrations/             # init · split_estimacion_liquidacion · add_precio_mp_kg
│   │   └── seed.js                 # usuarios/clientes/departamentos + 50 LIQUIDADA del CSV
│   │                               #   → OPERACIONES_REALES = []  (13 reales del Excel PENDIENTES)
│   ├── tests/                      # jest + supertest (Prisma y fetch ML mockeados)
│   ├── Dockerfile                  # node:22 (Prisma requiere OpenSSL del sistema; NO alpine/slim)
│   └── server.js                   # fail-fast sin JWT_SECRET · helmet · rate-limit · exporta app
│
├── ml_engine/                      # Motor de predicción (FastAPI)
│   ├── api.py                      # /predict y /health con X-Internal-Key (sin CORS: server-to-server)
│   ├── model/
│   │   ├── train.py                # PostgreSQL (LIQUIDADA) → GridSearchCV RF vs GB → gana menor MAE
│   │   ├── predict.py              # caché del pkl, rechazo de categorías desconocidas, clip [0,1]
│   │   ├── figures.py              # feature_importance.png + pred_vs_real.png (anexos tesis)
│   │   ├── train_output.txt        # salida completa del último entrenamiento (evidencia)
│   │   └── modelo_rf.pkl           # payload: modelo+encoders+classes+features+mae+r2 (gitignored)
│   ├── data/cotizaciones.csv       # 50 registros sintéticos de la tesis (fuente del seed)
│   ├── tests/                      # pytest (conftest inyecta modelo mínimo, no depende del pkl)
│   ├── requirements.txt / requirements-dev.txt
│   └── Dockerfile                  # python:3.12-slim + uvicorn (incluye el pkl del build context)
│
├── database/init.sql               # generado desde Prisma (prisma migrate diff) — NO editar a mano
├── .github/workflows/ci.yml        # jobs: pytest (ml_engine) + jest (backend)
├── docker-compose.yml               # demo: postgres + ml_engine + backend + frontend
├── docker-compose.prod.yml          # overrides de producción (secretos obligatorios, RUN_SEED=false, puerto 80)
└── .venv/                          # entorno Python (gitignored)
```

---

## 5. Modos de arranque

### A. Docker (demo de sustentación — recomendado para la defensa)

```bash
docker compose up -d --build
# Frontend: http://localhost:8080   ·   API (vía proxy nginx): http://localhost:8080/api/health
docker compose down        # apagar (el volumen pgdata persiste)
```

- El backend aplica `prisma migrate deploy` siempre; `prisma db seed` solo si `RUN_SEED=true` (default de esta demo — ver `.env.example`). En producción se deja sin definir para no crear usuarios con contraseñas conocidas en cada arranque.
- `modelo_rf.pkl` está gitignorado (es un binario, no vive en git) — un `git clone` fresco **no lo trae**, así que el primer arranque en una máquina/VPS nueva **requiere entrenar antes de cotizar**: `docker compose exec ml_engine python model/train.py` (lee las cotizaciones `LIQUIDADA` ya sembradas en PostgreSQL) y luego `docker compose restart ml_engine` (el modelo se cachea en memoria al primer uso). Sin este paso, `/api/ml/predict` devuelve 503/500 en todo intento de cotizar.
- Secretos por defecto de demo; sobrescribir con un `.env` en la raíz (`DB_PASSWORD`, `JWT_SECRET`, `ML_INTERNAL_SECRET`).
- El backend **no** expone su puerto al host — todo el tráfico entra por nginx (`:8080`) y se proxea internamente; no hay `localhost:5000` accesible desde fuera de Docker.

### A.1 Producción (VPS — Lightsail, EC2, etc.)

```bash
# .env en la raíz con DB_PASSWORD, JWT_SECRET, ML_INTERNAL_SECRET, CORS_ORIGIN reales
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

`docker-compose.prod.yml` exige los 4 secretos explícitos (falla al arrancar si falta alguno, no usa los defaults de demo), fuerza `RUN_SEED=false` sin importar el entorno, y remapea el frontend a `80:80`. Dominio real en uso: `frutransport.luisepzsls.dev` con HTTPS vía Cloudflare (Full-strict + Origin CA — ver `frontend/nginx.conf` y `docker-compose.prod.yml`). Pendiente de decisión del usuario: estrategia de backups del volumen `pgdata`.

### B. Manual (desarrollo, 3 terminales)

Prerrequisitos: Node 20+, Python 3.12+, PostgreSQL local corriendo, `backend/.env` creado desde `backend/.env.example`.

```bash
# Terminal 1 — Backend (:5000)
cd backend
npm install
npx prisma migrate dev        # aplica migraciones
npx prisma db seed            # usuarios + 50 cotizaciones LIQUIDADA
npm run dev

# Terminal 2 — ML Engine (:8000)
.venv\Scripts\activate                              # Windows (raíz del repo)
pip install -r ml_engine/requirements.txt           # solo la primera vez
python ml_engine/model/train.py                     # solo si no existe modelo_rf.pkl
cd ml_engine
$env:ML_INTERNAL_SECRET='<mismo valor que backend/.env>'
uvicorn api:app --port 8000 --reload

# Terminal 3 — Frontend (:5173)
cd frontend
npm install
npm run dev
```

### URLs y credenciales

| Servicio | Dev | Docker |
|---|---|---|
| Frontend | http://localhost:5173 | http://localhost:8080 |
| Backend health | http://localhost:5000/api/health | http://localhost:8080/api/health (proxeado por nginx — el backend no expone puerto propio) |
| ML docs (Swagger) | http://localhost:8000/docs | no expuesto (red interna) |

| Email | Rol → aterriza en |
|---|---|
| admin@frutransport.pe | ADMIN → `/admin/dashboard` |
| manager@frutransport.pe | MANAGER → `/admin/dashboard` |
| auditor@frutransport.pe | AUDITOR → `/auditor/historial` |
| importador@fresco-asia.com | Cliente externo → `/cliente/cotizaciones` |

Contraseñas: **no se documentan acá** (este archivo se versiona en git) — ver `credentials.md` en la raíz (gitignored, nunca se sube). El seed genera una contraseña aleatoria distinta por cuenta si no se define `SEED_*_PASSWORD` (ver `backend/.env.example`).

Pantallas clave de la demo: `/admin/ml` (cotizador con predicción en vivo) y `/admin/historial` (liquidación con modal).

---

## 6. Variables de entorno

`backend/.env` (plantilla en `backend/.env.example`; **nunca** se versiona el real):

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=frutransport_db
DB_USER=postgres
DB_PASSWORD=tu_password

# Prisma y train.py leen esta URL (train.py descarta el ?schema= de Prisma)
DATABASE_URL="postgresql://postgres:tu_password@localhost:5432/frutransport_db?schema=public"

# OBLIGATORIO: el server hace fail-fast si falta (sin fallback inseguro)
# Generar: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=
JWT_EXPIRES_IN=8h

ML_ENGINE_URL=http://localhost:8000
# Debe coincidir con el ML_INTERNAL_SECRET del proceso uvicorn
ML_INTERNAL_SECRET=
```

El motor ML solo necesita `ML_INTERNAL_SECRET` (para servir) y `DATABASE_URL` (para entrenar; `train.py` y `figures.py` la cargan automáticamente desde `backend/.env` si existe).

---

## 7. Base de datos

### Modelos Prisma (PostgreSQL) — fuente única: `backend/prisma/schema.prisma`

```
usuarios
  id UUID PK · email unique · password_hash · role (enum rol_erp: ADMIN|MANAGER|AUDITOR)
  activo · creado_en · actualizado_en

clientes                       (registro desde la landing o alta rápida desde el cotizador)
  id UUID PK · nombre_completo · empresa? · pais? · telefono?
  email unique · password_hash?  ← NULL = creado sin acceso al portal (activable después)
  verificado · activo · timestamps

productos                      (catálogo extensible del cotizador)
  id serial PK · nombre unique · activo · creado_en

destinos                       (catálogo extensible del cotizador)
  id serial PK · nombre unique · activo · creado_en

cotizaciones                   ★ separación estricta ESTIMADO vs REAL
  id serial PK · producto · variedad? · destino
  volumen_ton? · tipo_cargamento? · peso_neto_caja?       ← nullable: un borrador recién
                                                             creado (autoguardado) puede
                                                             no tenerlos todavía
  precio_mp_kg?                                           ← feature de entrenamiento
  -- Materia prima: decisión de negocio independiente de las cajas (no se deriva una de otra)
  cajas_contenedor? · kg_cosecha_comprados?
  costo_maquila? · costo_agenciamiento?(+moneda) · costo_sli?(+moneda)
  -- Recupero por venta del descarte: monto POSITIVO, se resta del costo total
  -- (campo dedicado — no un gasto adicional, no debe poder borrarse sin querer)
  recupero_descarte?(+moneda)
  tipo_cambio? · mes?
  porcentaje_descarte_estimado? · porcentaje_descarte_real?
  costo_total_estimado?         · costo_total_real?
  -- Utilidad → precio de venta / FOB por caja (ver §9 fórmula)
  utilidad_pct? · precio_venta_estimado? · precio_fob_caja_estimado?
  utilidad_real_pct? · precio_venta_real? · precio_fob_caja_real?
  -- Venta real: lo pactado (O/C) vs. lo REALMENTE facturado — puede ser
  -- menor al objetivo (costo+utilidad). resultadoCostoDirecto/ConUtilidad
  -- son CALCULADOS en la API (no columnas), ver §9.9
  valor_venta_oc?(+moneda) · valor_venta_factura?(+moneda)
  -- Logística y trazabilidad (reemplaza el registro manual en CONTENEDORES.xlsx)
  numero_booking? · numero_contenedor_logistica?
  fecha_cosecha_inicio? · fecha_cosecha_fin? · fecha_procesamiento? · fecha_llenado_despacho?
  -- Numeración secuencial: asignada UNA sola vez al APROBAR (nunca se recalcula)
  numero_contenedor_general? · numero_contenedor_cliente?
  estado (enum estado_cot: PENDIENTE|APROBADA|EN_TRANSITO|LIQUIDADA|RECHAZADA)
  notas? · creado_en (→ feature `mes`) · actualizado_en
  usuario_id FK? → usuarios · cliente_id FK? → clientes
  departamento_id FK → departamentos (NOT NULL — toda cotización pertenece a un rubro)

departamentos                  (los rubros que administra el ERP)
  id serial PK · nombre unique · slug unique · descripcion? · activo · orden

usuario_departamentos           ★ acceso por rubro (many-to-many)
  id serial PK · usuario_id FK (cascade) · departamento_id FK (cascade) · creado_en
  @@unique([usuario_id, departamento_id]) — ADMIN/AUDITOR no requieren fila aquí (acceso implícito)

notificaciones                  (central propia, no derivada)
  id serial PK · usuario_id FK (cascade) · tipo · mensaje · link? · leida · creado_en

lotes_materia_prima             (desglose de la compra por camión/complemento — informativo)
  id serial PK · etiqueta · kg · creado_en · cotizacion_id FK (cascade)

lotes_descarte_vendido          (kg × precioKg × moneda — se suma solo en recupero_descarte)
  id serial PK · kg · precio_kg · moneda (enum, default PEN) · creado_en · cotizacion_id FK (cascade)

gastos_cotizacion              ★ estructura variable de costos (CONTENEDORES.xlsx)
  id serial PK · concepto · monto (negativo = recupero/descuento)
  moneda (enum: PEN|USD) · creado_en · cotizacion_id FK (cascade)
```

Migraciones: `20260522_init` → `20260529_split_estimacion_liquidacion` → `20260707_add_precio_mp_kg` → `20260711_add_gastos_cotizacion` → `20260711_add_departamento_scoping` → `20260711_harden_departamento_id_not_null` → `20260712_add_catalogo_producto_destino_cliente_sin_password` (crea `productos`/`destinos`, relaja `clientes.password_hash` a opcional) → `20260713_cotizacion_kg_cosecha_utilidad_borrador` (cajas/kg de cosecha independientes, utilidad → precio de venta/FOB, campos nullable para soportar borradores autoguardados incompletos) → `20260714_cotizacion_logistica_numeracion` (booking, fechas de cosecha/procesamiento, contenedor de la naviera, numeración secuencial general/por cliente) → `20260715_recupero_descarte_lotes_materia_prima` (campo dedicado de recupero + tabla `lotes_materia_prima`) → `20260716_venta_real_resultado_lotes_descarte` (venta pactada/facturada real, tercera fecha logística, tabla `lotes_descarte_vendido`).

⚠ **Lección de la migración NOT NULL**: la primera versión de `harden_departamento_id_not_null` asumía un backfill hecho a mano fuera de la migración — funcionaba en el dev local donde se corrió el script, pero `prisma migrate deploy` fallaba (P3018) contra cualquier otra base de datos (p. ej. un volumen Docker limpio) porque el backfill no formaba parte de la migración. Se corrigió incluyendo el `INSERT`/`UPDATE` de backfill **dentro del `.sql` de la migración** — cualquier migración que endurezca una columna a NOT NULL sobre una tabla con datos debe traer su propio backfill, nunca uno externo.

### Seed (`npx prisma db seed`, idempotente)

1. 3 usuarios ERP + 2 clientes externos + 6 departamentos (upsert) + acceso por rubro (`admin@` los 6, `manager@` solo Agroexportación).
2. **Dataset de entrenamiento sintético**: los 50 registros de `ml_engine/data/cotizaciones.csv` insertados como cotizaciones `LIQUIDADA` (nota `"Registro histórico (dataset tesis)"`, idempotente).
3. **Operaciones reales**: los 13 contenedores de `CONTENEDORES.xlsx` (2023-2024), un registro por contenedor, nota `"Operación real (CNT XX)"`, idempotente. Convenciones (documentadas en `seed.js`): descarte = kg_descarte/(exportables+descarte); precio MP = promedio ponderado S//kg; costo directo sin extracostos extraordinarios; ventas locales → destino `Nacional`; contenedor mixto (CNT 09) → registro único con producto combinado `Palta Fuerte / Palta Hass`. ⚠ CNT 10-12 con descarte 0 **provisional** (el Excel no lo registró): corregir en `seed.js` → borrar por nota → re-seed → reentrenar.
4. **Clientes reales**: los 7 clientes (Razón Social de cada hoja del Excel — Palacios Escutia SL, Gabriel/Vicente, Century Farms Internacional, Seforpun EIRL, Inma Golden, Ping Fruit, Guerrero Mercovasa SL) asociados a sus contenedores vía `clienteId`, sin `passwordHash` (activables después desde Control de usuarios). Cada contenedor real trae además su numeración (`numeroContenedorGeneral`/`Cliente`, coincide con "N° CONTENEDOR GENERAL/CLIENTE" del Excel) y su trazabilidad de logística (booking, contenedor de la naviera, fechas de cosecha/procesamiento) extraída directamente de cada hoja `CNT XX`.

`database/init.sql` se regenera desde Prisma (no editar a mano):
```bash
cd backend && npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > ../database/init.sql
```

---

## 8. API REST — Endpoints

Auth: `Authorization: Bearer <JWT>`. El JWT porta `{ id, email, role }`.

| Método | Ruta | Auth | Rol | Descripción |
|---|---|---|---|---|
| GET | `/api/health` | — | — | Estado del backend |
| POST | `/api/auth/login` | — | — | Login vs PostgreSQL (bcrypt). Rate-limit: 10 intentos fallidos / 15 min / IP |
| GET | `/api/auth/me` | JWT | — | Rehidratación de sesión del frontend |
| GET | `/api/cotizaciones?page=1&estado=PENDIENTE&departamentoId=1&clienteId=&ordenarPor=contenedor&soloConNumero=true` | JWT | cualquiera | Paginada (20/página). CLIENTE: forzado a `where.clienteId = self` (no ve nada de otros). Sin `departamentoId` (ADMIN/MANAGER/AUDITOR): ADMIN/AUDITOR ven todos los rubros, MANAGER solo los suyos. Con `departamentoId`: 403 si no tiene acceso a ese rubro. `clienteId` (staff): filtro adicional dentro del rubro ya resuelto. `ordenarPor=contenedor`: orden por `numeroContenedorGeneral` asc en vez de fecha (usado por `/admin/contenedores`). `soloConNumero=true`: excluye registros sin numeración asignada (dataset sintético y cotizaciones previas a esta feature) |
| GET | `/api/cotizaciones/:id` | JWT | cualquiera | Detalle de una cotización — usado para resumir un borrador (`?borrador=id` en `/admin/ml`) o ver el detalle en Historial. CLIENTE: 404 si no es suya (no 403, para no confirmar existencia); resto: 403 si no administra el rubro |
| POST | `/api/cotizaciones` | JWT | ADMIN, MANAGER | Crea un **borrador PENDIENTE** — solo `producto`, `destino` y `departamentoId` son obligatorios (autoguardado apenas se toca el formulario del cotizador); el resto de campos son opcionales y quedan `NULL` hasta completarse. `clienteId` opcional (asocia la cotización a un cliente del directorio); `usuarioId` del JWT; `gastos[]` opcional se persiste en `gastos_cotizacion` (nested create); dispara notificación a ADMIN/MANAGER del rubro |
| PATCH | `/api/cotizaciones/:id` | JWT | ADMIN, MANAGER | Autoguardado del borrador: actualiza parcialmente cualquier subconjunto de campos (mismo esquema relajado que POST, sin `departamentoId` — el rubro no se reasigna). Si se envía `gastos[]`, reemplaza por completo los gastos existentes. Solo permitido con `estado: PENDIENTE` (409 si ya está LIQUIDADA) |
| PATCH | `/api/cotizaciones/:id/aprobar` | JWT | ADMIN, MANAGER | PENDIENTE → APROBADA — momento en que la cotización deja de ser una estimación editable y se vuelve un **contenedor real a trackear**: asigna (una sola vez, nunca se recalcula) `numeroContenedorGeneral`/`Cliente`, visibles después en `/admin/contenedores`. 400 si falta algún componente obligatorio del costo (mismo chequeo que liquidar), 404 si no existe, 409 si no está PENDIENTE, 403 si no administra el rubro |
| PATCH | `/api/cotizaciones/:id/liquidar` | JWT | ADMIN, MANAGER | Registra `porcentajeDescarteReal`, `costoTotalReal` y `utilidadRealPct`; calcula `precioVentaReal`/`precioFobCajaReal`; estado → LIQUIDADA. 400 si falta algún componente obligatorio del costo, 404 si no existe, **409 si no está APROBADA** (debe aprobarse primero — así ningún contenedor real queda liquidado sin numeración), 403 si no administra el rubro; notifica al creador |
| PATCH | `/api/cotizaciones/:id/reabrir` | JWT | ADMIN, MANAGER | Retrocede **un** paso: LIQUIDADA → APROBADA (limpia descarte/costo/utilidad real y venta facturada) o APROBADA → PENDIENTE (limpia numeración de contenedor y venta O/C, vuelve a ser editable). 409 si ya está PENDIENTE, 404 si no existe, 403 si no administra el rubro. Único mecanismo para corregir un aprobar/liquidar por error |
| GET | `/api/cotizaciones/gastos-habituales` | JWT | ADMIN, MANAGER | Analítica basada en histórico (NO un modelo de ML entrenado): gastos adicionales que aparecen en ≥60% de las cotizaciones `LIQUIDADA` (línea base curada mientras haya <5 muestras) + `estadisticasMonto` por concepto (mediana + MAD en USD, detección de anomalías en el monto con ≥5 muestras) — ver §9.8 |
| POST | `/api/ml/predict` | JWT | cualquiera | Predicción + costo determinístico (detalle abajo) |
| GET | `/api/ml/health` | — | — | Proxy al `/health` del motor (modelo, MAE, R²) |
| GET | `/api/ml/categorias` | JWT | cualquiera | Proxy a `GET /categorias` del motor ML: `{ producto: [], destino: [] }` con las categorías vistas en el último entrenamiento — el frontend marca "sin entrenar" cualquier entrada del catálogo que no esté en estas listas. 503 si el motor no responde |
| GET | `/api/tipo-cambio?fecha=YYYY-MM-DD` | JWT | cualquiera | Tipo de cambio oficial SUNAT (sin fecha = del día); cacheado por fecha (10 min "hoy", indefinido histórico) |
| GET | `/api/departamentos` | JWT | ADMIN | Catálogo completo de rubros (para la UI de asignación) |
| GET | `/api/departamentos/mios` | JWT | cualquiera | Rubros que el usuario puede operar (ADMIN/AUDITOR: todos; MANAGER: asignados) |
| GET | `/api/usuarios` | JWT | ADMIN | Lista usuarios ERP con sus rubros asignados |
| POST | `/api/usuarios` | JWT | ADMIN | Crea usuario (`email`, `password` ≥8, `role`, `departamentoIds[]` opcional). 409 si el email ya existe |
| PATCH | `/api/usuarios/:id` | JWT | ADMIN | Actualiza `role` y/o `activo` (nunca DELETE). Un admin no puede desactivarse a sí mismo |
| PATCH | `/api/usuarios/:id/departamentos` | JWT | ADMIN | Reemplaza el conjunto de rubros asignados a ese usuario |
| GET | `/api/clientes` | JWT | ADMIN, MANAGER | Directorio de clientes del portal externo, con `tieneAcceso` derivado (`password_hash != null`, nunca se expone el hash) |
| POST | `/api/clientes` | JWT | ADMIN, MANAGER | Alta rápida **sin acceso al portal** (`password_hash: null`) — pensada para crearse desde el propio cotizador o desde Control de usuarios. 409 si el email ya existe |
| PATCH | `/api/clientes/:id/activar-acceso` | JWT | ADMIN | Asigna una contraseña inicial (bcrypt, ≥8) y habilita el login del cliente al portal (`verificado: true`). 404 si no existe |
| GET | `/api/productos` | JWT | cualquiera | Catálogo de productos del cotizador (activos e inactivos) |
| POST | `/api/productos` | JWT | ADMIN | Crea producto (`nombre` único). 409 si ya existe |
| PATCH | `/api/productos/:id` | JWT | ADMIN | Actualiza `nombre` y/o `activo` (nunca DELETE) |
| GET | `/api/destinos` | JWT | cualquiera | Catálogo de destinos del cotizador (activos e inactivos) |
| POST | `/api/destinos` | JWT | ADMIN | Crea destino (`nombre` único). 409 si ya existe |
| PATCH | `/api/destinos/:id` | JWT | ADMIN | Actualiza `nombre` y/o `activo` (nunca DELETE) |
| GET | `/api/notificaciones` | JWT | cualquiera | Notificaciones propias (no leídas primero), + conteo `noLeidas` |
| PATCH | `/api/notificaciones/:id/leer` | JWT | cualquiera | Marca una notificación propia como leída |
| PATCH | `/api/notificaciones/leer-todas` | JWT | cualquiera | Marca todas las notificaciones propias como leídas |

### POST /api/ml/predict — contrato

Entrada (zod): `producto`, `destino` (strings), `precio_mp_kg`, `peso_neto_caja`, `costo_maquila` (> 0), `cajas_contenedor` (entero > 0), `kg_cosecha_comprados` (> 0), `tipo_cambio` (∈ [3, 5]), `costo_agenciamiento`, `costo_sli` (> 0, en USD por defecto — ver nota de monedas abajo), `utilidad_pct` (∈ [0,1]), `mes` (∈ [1,12], opcional — default: mes actual), y opcionalmente `gastos_adicionales: [{concepto, monto ≠ 0, moneda: PEN|USD}]` (máx. 40) — la estructura variable de costos de la operación real (supervisión, fletes de camiones, jabas, extracostos…; monto negativo = recupero, p. ej. venta de descarte). Los PEN se convierten con `tipo_cambio` y el neto se suma al costo total; el desglose incluye `gastos_adicionales_total` y el detalle por concepto. `cotizacion_sugerida` viaja listo para persistirse (POST/PATCH `/api/cotizaciones`).

**Materia prima independiente de las cajas.** `cajas_contenedor` (cuántas cajas lleva el contenedor) y `kg_cosecha_comprados` (cuánta cosecha se negoció comprar, a qué precio por kg) son decisiones de negocio **independientes** — no una se deriva de la otra. El costo de materia prima se calcula directo (`kg_cosecha_comprados × precio_mp_kg / tipo_cambio`); el % de descarte estimado por el modelo solo se usa de forma informativa para proyectar cuántas cajas rendiría esa cosecha (`cajas_posibles_estimadas`), sin alterar el costo.

**No hay campo de flete marítimo.** Las 13 operaciones reales (`CONTENEDORES.xlsx`) venden en términos **FOB** ("PRECIO FOB CAJA" en cada hoja) — el flete internacional lo asume el comprador, nunca Frutransport. Si alguna venta futura no fuera FOB, el flete se registra como `gastos_adicionales`.

**Monedas de agenciamiento y SLI:** ambos se cotizan naturalmente en USD (`costo_agenciamiento_moneda` / `costo_sli_moneda`, enum `PEN|USD`, default `USD`). Si se envía `PEN`, el monto se convierte con `tipo_cambio` antes de sumarse — el mismo patrón que los gastos adicionales.

**Utilidad → precio de venta / FOB por caja.** `utilidad_pct` es el % que el cotizador elige sobre el subtotal de costos (todo incluido) para llegar al precio de venta total y, dividido entre `cajas_contenedor`, al precio FOB por caja — la cifra que efectivamente se cotiza al cliente. Validado contra el CNT 01 real: `42977.87 × 1.08 / 2400 = 19.34` USD/caja.

Respuesta 200:
```jsonc
{
  "ok": true,
  "estimacion_pre_compra": {
    "costo_total_estimado": 12882.13,          // USD — subtotal de costos (todo incluido)
    "desglose": { "materia_prima": ..., "maquila": ...,
                  "agenciamiento": ..., "sli": ..., "costos_fijos_total": ...,
                  "gastos_adicionales_total": ... },
    "gastos_adicionales": [ /* detalle por concepto, ya en USD */ ],
    "utilidad_usd": 1030.57,
    "precio_venta_total": 13912.70,
    "precio_fob_caja": 5.80,                   // ← la cifra que se cotiza al cliente
    "cajas_posibles_estimadas": 2396,          // informativo: rendimiento esperado de la cosecha
    "kg_netos_esperados": 24447.8
  },
  "metadatos_ml": { "porcentaje_descarte_estimado": 0.1003, "mae": 0.0227,
                    "r2": 0.6256, "modelo": "Gradient Boosting" },
  "cotizacion_sugerida": {                      // ← payload listo para POST/PATCH /api/cotizaciones
    "producto": "...", "variedad": null, "destino": "...", "volumenTon": 4.8,
    "tipoCargamento": "CONTENEDOR", "pesoNetoCaja": 4.0, "precioMpKg": 4.5,
    "cajasContenedor": 2400, "kgCosechaComprados": 26000, "costoMaquila": 8.5,
    "costoAgenciamiento": 1800, "costoAgenciamientoMoneda": "USD",
    "costoSli": 2200, "costoSliMoneda": "USD", "tipoCambio": 3.72, "mes": 4,
    "utilidadPct": 0.08, "porcentajeDescarteEstimado": 0.1003,
    "costoTotalEstimado": 12882.13, "precioVentaEstimado": 13912.70,
    "precioFobCajaEstimado": 5.80, "gastos": []
  },
  "solicitante": "admin@frutransport.pe"
}
```

Errores relevantes: **400** descarte ≥ 60% (mensaje "…demasiado alta…", la UI lo muestra como advertencia de riesgo, no como error genérico) · **400** categoría desconocida (reenviado del motor) · **503** motor ML caído (ECONNREFUSED).

### GET /api/tipo-cambio — contrato

Proxy a la API pública `api.apis.net.pe/v1/tipo-cambio-sunat` (sin API key), cacheado 10 minutos en memoria del backend (la SUNAT publica una vez al día). Respuesta: `{ compra, venta, fecha, fuente: "SUNAT" }`. El frontend precarga `tipo_cambio` con `venta` al abrir el cotizador; el campo sigue siendo editable manualmente. **503** si SUNAT no responde — el formulario avisa y exige ingresar el TC a mano.

### Fórmula determinística del costo (mlController)

```
costo_mp    = kg_cosecha_comprados × precio_mp_kg / tipo_cambio     ← directo, NO depende de cajas
maquila     = cajas_contenedor × costo_maquila / tipo_cambio
agenciamiento_usd = costo_agenciamiento [/ tipo_cambio si moneda=PEN]
sli_usd           = costo_sli [/ tipo_cambio si moneda=PEN]
subtotal_costos = costo_mp + maquila + agenciamiento_usd + sli_usd + gastos_adicionales   (todo en USD)

utilidad_usd      = subtotal_costos × utilidad_pct
precio_venta_total = subtotal_costos + utilidad_usd
precio_fob_caja    = precio_venta_total / cajas_contenedor          ← cifra cotizada al cliente

-- Informativo, no afecta el costo: ¿alcanza la cosecha para las cajas elegidas?
kg_netos_esperados        = kg_cosecha_comprados × (1 − descarte_predicho)   ← única entrada del ML
cajas_posibles_estimadas  = floor(kg_netos_esperados / peso_neto_caja)
```

### Motor ML interno (FastAPI :8000 — solo server-to-server)

| Método | Ruta | Auth |
|---|---|---|
| POST | `/predict` | header `X-Internal-Key` (401 si no coincide con `ML_INTERNAL_SECRET`) |
| GET | `/health` | ídem |

Entrada de `/predict` (Pydantic): `producto`, `destino`, `precio_mp_kg` (> 0), `mes` (1–12). Sin CORS: nunca recibe tráfico de navegador.

---

## 9. Motor ML — Implementación detallada

**Problema de regresión supervisada**: predecir `porcentaje_descarte_real` ∈ [0,1]. El costo NO lo predice el modelo — se deriva contablemente (§8).

### 9.1 Features y target — `model/train.py`

```python
FEATURES = ['producto', 'destino', 'precio_mp_kg', 'mes']   # mes ← extraído de creado_en
TARGET   = 'porcentaje_descarte_real'
```

- **Extracción directa de PostgreSQL** (`WHERE estado='LIQUIDADA' AND porcentaje_descarte_real IS NOT NULL`) → cero data leakage: nunca entrena con estimados.
- `DATABASE_URL` de Prisma se sanea (se elimina `?schema=`, inválido para psycopg2).
- Filas con `precio_mp_kg` NULL se descartan (dropna sobre features).
- Categóricas via `LabelEncoder` persistido en el pkl; **inferencia rechaza categorías no vistas** (ValueError → 400), no hay fallback silencioso.

### 9.2 Selección de modelo

`GridSearchCV(scoring='neg_mean_absolute_error', cv=5)` sobre dos candidatos:

| Modelo | Grilla |
|---|---|
| RandomForestRegressor | n_estimators [100,200] · max_depth [3,5,7] · min_samples_split [2,5,10] |
| GradientBoostingRegressor | n_estimators [100,200] · learning_rate [0.01,0.05,0.1] · max_depth [2,3,4] |

**El criterio de selección es MAE** (no RMSE ni R²) — interpretable como puntos porcentuales de descarte; en empate gana RF (`rf_mae <= gb_mae`). El ganador se reentrena sobre el 100% de los datos antes de serializar. Split de evaluación: 80/20, `random_state=42`.

### 9.3 Payload serializado (`modelo_rf.pkl`, joblib)

```python
{ 'model', 'encoders', 'classes', 'features', 'r2', 'mae', 'model_name' }
```

`predict.py` cachea el payload en memoria (`_cache`): **cambiar el pkl exige reiniciar uvicorn** (el `--reload` no invalida el caché). Salida de inferencia con clip a [0,1].

### 9.4 Métricas vigentes (63 registros LIQUIDADA: 50 sintéticos + 13 reales — el dataset de la tesis)

```
Random Forest      RMSE 0.0500 · MAE 0.0264 · R² 0.4827
Gradient Boosting  RMSE 0.0425 · MAE 0.0227 · R² 0.6256   ← GANADOR (por MAE)
GB: learning_rate=0.1, max_depth=3, n_estimators=200
```

Salida completa en `ml_engine/model/train_output.txt`. **Lectura honesta para la tesis:** el modelo predice el descarte con un error medio de **±2.3 puntos porcentuales** (MAE, el criterio real de selección del código). El R² de 0.63 sobre un test de 13 filas es orientativo: los registros reales son heterogéneos (mandarinas con descartes del 5% al 35%, tres operaciones con descarte 0% provisional). Sobre los registros sintéticos el error sigue siendo < 0.01. Las métricas mejorarán si se completan los descartes reales de CNT 10-12 y se confirma el dato duplicado de CNT 06 (§14).

### 9.5 Figuras para la tesis — `model/figures.py`

```bash
python ml_engine/model/figures.py
# → ml_engine/model/feature_importance.png  (importancia de variables del modelo ganador)
# → ml_engine/model/pred_vs_real.png        (scatter test con diagonal de referencia y MAE)
```

### 9.6 Categorías válidas (las únicas vistas en entrenamiento)

- **producto**: `Palta Hass` · `Palta Fuerte` · `Palta Fuerte / Palta Hass` (contenedor mixto, CNT 09) · `Mandarina Malvacea`
- **destino**: `España` · `EE.UU.` · `México` · `Países Bajos` · `Nacional` (ventas a clientes locales, CNT 05-07)

El contenedor es la unidad de negocio: un contenedor mixto se cotiza y registra completo, con su producto combinado como categoría propia y el precio MP promedio ponderado de los lotes.

El formulario del frontend las ofrece en `<select>` cerrados; el motor rechaza cualquier otra con 400.

### 9.7 Reentrenamiento (ciclo completo)

```bash
# 1. Liquidar operaciones desde /admin/historial (acumula datos reales)
# 2. Reentrenar (lee PostgreSQL directamente, NO usa el CSV):
python ml_engine/model/train.py > ml_engine/model/train_output.txt 2>&1
# 3. Regenerar figuras:
python ml_engine/model/figures.py
# 4. REINICIAR uvicorn (caché del pkl en memoria)
```

Síntoma de pkl desactualizado/corrupto: predicciones de descarte 100% constantes → reentrenar.

### 9.8 Alertas del cotizador: gastos habituales faltantes + anomalías de monto (NO es el modelo de ML entrenado)

Distinta del modelo de regresión (9.1-9.7), esta es una **segunda capa de apoyo a la decisión** — analítica sobre datos históricos + reglas de negocio, no un modelo entrenado. Vive en `GET /api/cotizaciones/gastos-habituales` y en las validaciones de `cotizacionesController.js`. Cubre **todo** el costo del contenedor, no solo los gastos sueltos:

- **Componentes obligatorios** (kg de cosecha, precio MP, cajas, maquila, agenciamiento, SLI): `PATCH /:id/liquidar` **bloquea** con 400 si falta alguno — no son "a veces sí, a veces no", son estructurales en toda cotización.
- **Gastos habituales** (flete, jabas, supervisión, cartón, gastos administrativos…): frecuencia real entre cotizaciones `LIQUIDADA` (línea base curada mientras haya <5 muestras) — solo **advierte**, no bloquea.
- **Anomalías de monto**: mediana + MAD (*Median Absolute Deviation*) en USD por concepto, con ≥5 muestras — z-score modificado (Iglewicz & Hoaglin) `z = 0.6745 × (monto − mediana) / MAD`; `|z| > 3.5` marca el monto como atípico. Robusto ante muestras chicas y ante el propio outlier que se busca detectar (a diferencia de media/desviación estándar).

**Limitación honesta:** los 13 CNT reales del seed no tienen gastos desglosados por concepto (solo el costo total agregado), así que hoy ambas analíticas arrancan en modo "línea base"/sin señal — se activan automáticamente por concepto en cuanto el ERP acumule ≥5 cotizaciones liquidadas con ese gasto desde su propio uso.

### 9.9 Venta real y resultado del contenedor — la brecha más importante que tenía el sistema

Hasta esta feature, el ERP solo comparaba **costo estimado vs. costo real** y calculaba un **precio de venta objetivo** (costo + % de utilidad elegido) — nunca registraba cuánto se vendió *realmente*, así que no había forma de saber si un contenedor ganó o perdió dinero de verdad. `CONTENEDORES.xlsx` sí lo hacía (filas "VALOR DE VENTA O/C", "VALOR VENTA A FACTURA", "RESULTADO DEL CNT…").

- **`valorVentaOc`** (+moneda): lo pactado en la orden de compra — se registra opcionalmente al **aprobar** (`PATCH /:id/aprobar`), antes de que exista una venta real.
- **`valorVentaFactura`** (+moneda): lo **realmente facturado** — se registra opcionalmente al **liquidar** (`PATCH /:id/liquidar`), junto a los demás valores reales de cierre.
- **`resultadoCostoDirecto`** / **`resultadoConUtilidad`**: campos **calculados** (no columnas de la BD) que devuelven `GET /api/cotizaciones` y `GET /api/cotizaciones/:id` — `valorVentaFactura − costo` (real si ya se liquidó, si no el estimado) y `valorVentaFactura − precio con utilidad`. `null` mientras no haya venta facturada.

**Verificado con el CNT 01 real** (`CONTENEDORES.xlsx`): venta pactada \$44,352, venta real facturada \$39,297.34 (muy por debajo de lo pactado), costo \$42,977.87, precio objetivo con 8% de utilidad \$46,416.10 → `resultadoCostoDirecto = -3,680.53` y `resultadoConUtilidad = -7,118.76`. **El contenedor perdió dinero de verdad**, pese a que la utilidad planeada era positiva — exactamente lo que el Excel ya calculaba y el sistema anterior no podía mostrar. Reproducido exacto en test automatizado y e2e contra Docker.

**Lotes de descarte vendido** (`lotes_descarte_vendido`: kg × precioKg × moneda): el Excel desglosa el recupero por descarte igual que la materia prima (p. ej. 1,490.3 kg a \$0.40 + 30.6 kg a \$0.20) — el cotizador ahora permite cargar esos lotes y **calcula solo** el total, que llena automáticamente `recuperoDescarte` (el input manual se deshabilita mientras haya lotes, para no tener dos fuentes de verdad).

---

## 10. Frontend — Pantallas del ERP

| Ruta | Componente | Estado |
|---|---|---|
| `/` | LandingPage (multiidioma ES/EN/PT/ZH) | ✅ |
| `/login` | Login → redirige por rol | ✅ |
| `/unauthorized` | Acceso denegado con retorno al home del rol | ✅ |
| `/admin/dashboard` | Dashboard del rubro activo: KPIs + estado de servicios (Agroexportación) o panel "en construcción" (otros rubros) | ✅ |
| `/admin/ml` | **MLCotizaciones** — orden: **cliente primero** (opcional; muestra el N° de contenedor de ese cliente y el N° general de la empresa, asignados al aprobar), luego producto/destino/costos (cajas y kg de cosecha comprados como decisiones independientes, % de utilidad, recupero por venta de descarte — con "Lotes de descarte vendido" que suman solos kg×precio), datos de logística y trazabilidad (booking, 3 fechas — cosecha/procesamiento/llenado-despacho, contenedor de la naviera), "Lotes de materia prima" (desglose por camión/complemento) y Notas (causa raíz de anomalías, texto libre), debounce 500 ms, TC precargado desde SUNAT, producto/destino desde el catálogo dinámico (marca "sin entrenar" si no está en `/api/ml/categorias`), panel en vivo (precio FOB por caja, precio de venta, desglose, % descarte, cajas posibles según la cosecha, modelo/MAE, latencia), advertencia del bloqueo 60%, alertas de componentes de costo/gastos habituales faltantes y de monto anómalo (§9.8). **Autoguardado gateado**: no persiste nada hasta que el usuario pulsa **"Iniciar cotización"** (o resume un borrador vía `?borrador=id`) — evita que recargar la página sin querer genere PENDIENTEs duplicados en Historial; una vez iniciado, cada cambio crea/actualiza el mismo borrador, y **"Nueva cotización"** resetea el formulario para empezar otro. Redirige a `/admin/dashboard` si el rubro activo no es Agroexportación | ✅ |
| `/admin/historial` | **Historial** — `TablaCotizaciones` acotada al rubro activo: paginada, estado/origen (sintética vs real) por badge, detalle + descarga PDF (con venta real y resultado, ver §9.9), **Continuar editando** (PENDIENTE, vuelve a `/admin/ml` con todo precargado), **Aprobar** (modal con venta pactada O/C opcional, PENDIENTE + costo completo → APROBADA, asigna el N° de contenedor — deja de ser editable), **Liquidar** (modal con venta real facturada opcional, solo APROBADA) | ✅ |
| `/admin/contenedores` | **Contenedores** — control total del contenedor (reemplaza `CONTENEDORES.xlsx`): lista ordenada por N° de contenedor (general y por cliente), filtro por cliente, columnas de logística (booking, N° de contenedor de la naviera, fechas de cosecha/procesamiento); solo cotizaciones APROBADA/LIQUIDADA (numeradas) — un PENDIENTE recién creado o el dataset sintético no aparecen acá; reutiliza el mismo `ModalDetalle` de Historial | ✅ |
| `/admin/usuarios` | **Usuarios** (exclusivo ADMIN, guard explícito) — pestaña Usuarios ERP (crear, rol, activar/desactivar, asignar rubros) y pestaña Clientes (alta rápida sin acceso, badge de acceso al portal, **Activar acceso** para asignar contraseña) | ✅ |
| `/admin/catalogo` | **Catalogo** (exclusivo ADMIN) — pestañas Productos/Destinos: crear, editar nombre, activar/desactivar; badge "Entrenado"/"Sin entrenar" según `/api/ml/categorias` | ✅ |
| `/admin/reportes` | Reportes | 🔲 stub |
| `/auditor/historial` | Misma tabla en `soloLectura`, sin filtro de rubro (audita todos) | ✅ |
| `/auditor/reportes` | Reportes auditor | 🔲 stub |
| `/cliente/cotizaciones` | Portal cliente — `TablaCotizaciones` en `soloLectura` + `vistaExterna` (oculta columnas internas Usuario/Origen); el backend ya restringe a `where.clienteId = self` | ✅ |

Convenciones: roles sin traducir (`user.role` con los strings del enum de Prisma), paleta marfil/verde con modo oscuro (`[data-theme]`), lazy loading por zona. Usuario + cerrar sesión, notificaciones y selector de rubro viven en el **Topbar** (arriba a la derecha / izquierda), no en el pie del sidebar.

---

## 11. Roles y acceso ERP

Fuente única: enum `rol_erp` de Prisma + `CLIENTE` para el portal externo. **Nunca se traducen en el frontend.**

| Rol | Zona | Cotizar (`/admin/ml`) | Liquidar | Historial |
|---|---|---|---|---|
| **ADMIN** | `/admin/*` | ✅ | ✅ | ✅ |
| **MANAGER** | `/admin/*` | ✅ | ✅ | ✅ |
| **AUDITOR** | `/auditor/*` | ❌ (403 en POST) | ❌ (403) | ✅ solo lectura |
| **CLIENTE** | `/cliente/*` | — | — | ✅ solo lectura, acotado a sus propias cotizaciones (`clienteId`) |

Enforcement en 3 capas: `ProtectedRoute` (UI) → `verifyToken` + `requireRole` (API) → constraints de BD.

---

## 12. Rubros, control de usuarios y notificaciones

El ERP administra **varios rubros dentro de la misma empresa** (Agroexportación, Importaciones, Servicios Automotrices, Logística y Mudanzas, Transporte Pesado, Telecomunicaciones — tabla `departamentos`, ya existía desde el prompt 0 pero no se usaba en ningún flujo). Esta sección cierra ese ciclo.

### 12.1 Acceso por rubro

Tabla puente `usuario_departamentos` (many-to-many): qué ADMIN/MANAGER administra qué rubro. Lógica en `backend/services/accesoDepartamento.js`:

- **ADMIN y AUDITOR** operan/auditan **todos** los rubros sin necesidad de asignación explícita (ADMIN administra de punta a punta; AUDITOR audita todos por función, nunca aparece en la tabla puente).
- **MANAGER** solo ve/opera los rubros que tenga asignados. Sin ninguno asignado, ve un historial vacío (no es un error).
- `Cotizacion.departamentoId` es **obligatorio** (FK, NOT NULL) — toda cotización pertenece a un rubro. Las 63 cotizaciones del dataset de entrenamiento son de Agroexportación.
- Seed: `admin@` con acceso a los 6 rubros, `manager@` solo a Agroexportación (el único con funcionalidad real hoy).

### 12.2 Selector de rubro (Topbar)

`RubroContext` carga `GET /api/departamentos/mios` al iniciar sesión, persiste el rubro activo en `localStorage` (cae al primero disponible si el guardado ya no es accesible) y lo expone al Sidebar y a las páginas. El **Sidebar cambia de contenido según el rubro activo**: Agroexportación mantiene Cotizaciones ML / Historial / Reportes; cualquier otro rubro solo muestra un Dashboard genérico "en construcción" (sin inventar módulos de negocio no solicitados — decisión deliberada de alcance). `MLCotizaciones` e Historial redirigen a `/admin/dashboard` si se navega a ellas por URL directa estando en un rubro que no es Agroexportación.

### 12.3 Control de usuarios (`/admin/usuarios`, exclusivo ADMIN)

- **Usuarios ERP**: crear (`email`, `password`, `role`, rubros iniciales), editar rol, activar/desactivar (nunca `DELETE` — desactivar bloquea el login vía el `activo` que ya validaba `auth.js`), asignar/reasignar rubros. Un ADMIN no puede desactivar su propia cuenta.
- **Clientes**: directorio de la tabla `clientes` con alta rápida (`+ Nuevo cliente`, sin acceso al portal) y **Activar acceso** (asigna contraseña inicial) para los que todavía no tienen — ver §12.7.

### 12.7 Clientes sin acceso, catálogo de productos/destinos y ML "sin entrenar"

- **Ciclo de vida del cliente**: se crea como registro de seguimiento (`password_hash: null`, `POST /api/clientes`, desde Control de usuarios o — a futuro — desde el propio cotizador) y **no puede loguearse al portal** hasta que un ADMIN ejecuta `PATCH /api/clientes/:id/activar-acceso` con una contraseña inicial. Decisión explícita: separar "soy un contacto de negocio" de "tengo cuenta en el portal", porque la mayoría de clientes reales no necesitan seguimiento self-service de inmediato.
- **Cotización ↔ cliente**: `Cotizacion.clienteId` es opcional; `MLCotizaciones` expone un selector "Cliente (opcional)" que se envía junto al `departamentoId` al guardar. El portal (`/cliente/cotizaciones`) filtra `where.clienteId = self` en el backend — un cliente nunca puede ver cotizaciones de otro.
- **Catálogo extensible (`/admin/catalogo`)**: `productos` y `destinos` dejan de estar hardcodeados en el frontend — son tablas propias (upsert desde el seed con las 4 categorías de producto y 5 de destino originales del entrenamiento). Un ADMIN puede agregar nuevas entradas en cualquier momento.
- **Límite real del modelo ML**: el `LabelEncoder` de scikit-learn solo reconoce las categorías vistas en el entrenamiento — una categoría nueva del catálogo hace que `/predict` la rechace con 400 hasta el próximo reentrenamiento. `GET /api/ml/categorias` expone las clases actuales del `.pkl`, y tanto `/admin/catalogo` como el selector de producto/destino en `/admin/ml` marcan "sin entrenar" lo que todavía no es predecible — visibilidad, no bloqueo preventivo (el propio motor ya corta la petición si hace falta).

### 12.4 Notificaciones (tabla propia, no derivada)

Tabla `notificaciones` (`usuario_id`, `tipo`, `mensaje`, `link`, `leida`). Se generan de forma síncrona en el mismo request que dispara el evento (`backend/services/notificaciones.js`):

- **Cotización creada** → notifica a ADMIN + MANAGER con acceso a ese rubro (excepto al creador).
- **Cotización liquidada** → notifica al creador original (si es distinto de quien liquidó).

El Topbar (`NotificationBell`) hace polling cada 60 s (sin websockets — volumen bajo no lo justifica), muestra el conteo de no leídas y permite marcar una o todas.

### 12.5 Login de clientes

`POST /api/auth/login` ahora también busca en `clientes` si el email no está en `usuarios`, emitiendo `role: 'CLIENTE'`. Antes de esto, los clientes sembrados nunca podían autenticarse (el login solo consultaba `usuarios`).

### 12.6 Modo oscuro

Mismos tokens `oklch()` de `index.css`, variante `[data-theme="dark"]` (mismos hues, luminosidad invertida). `ThemeContext` seguía `prefers-color-scheme` en vivo hasta que el usuario toca el toggle (persiste en `localStorage`); un script inline en `index.html` aplica el tema antes de que React monte, para no parpadear. Toggle disponible en la landing (Header) y en el Topbar de todas las zonas autenticadas (admin/auditor/cliente).

---

## 13. Seguridad

**Medidas vigentes** (ROADMAP §3 aplicado):
- Login real contra PostgreSQL con `bcrypt.compare`; sin usuarios hardcodeados.
- `JWT_SECRET` obligatorio — el server **no arranca** sin él (sin fallback `dev-secret`).
- `helmet` + rate-limit en `/api/auth/login` (10 intentos **fallidos** / 15 min / IP → 429).
- Validación `zod` en `POST /api/ml/predict` y `POST/PATCH /api/cotizaciones` (rangos estrictos).
- Motor ML sin CORS y autenticado por `X-Internal-Key`; no expuesto en Docker (red interna).
- Corte de riesgo: descarte ≥ 60% → 400 (no se permite guardar operaciones inviables).
- `.env` y `credentials.md` ignorados por git (verificado: nunca hubo secretos en el historial); `.env.example` sí versionado.
- `database/init.sql` regenerado desde Prisma; eliminados `db.js` (pool legacy sin uso) y `demo_data.sql` (esquema viejo).

**Secretos rotados** (2026-07-23): `JWT_SECRET`, `ML_INTERNAL_SECRET` y la contraseña de PostgreSQL local ya no son los placeholders originales — valores aleatorios reales en `backend/.env` (nunca versionado). Las 5 contraseñas de las cuentas del seed (`admin@`, `manager@`, `auditor@`, los 2 clientes) tampoco están hardcodeadas: `backend/prisma/seed.js` las toma de variables `SEED_*_PASSWORD` (ver `backend/.env.example`) y, si faltan, genera una aleatoria e impredecible por cuenta. Los valores reales en uso viven en `credentials.md` (gitignored) — **nunca en este archivo ni en ningún `.md` versionado.**

**Limitación conocida**: JWT en `localStorage` (vulnerable a XSS). Aceptable para alcance académico; en producción migrar a cookies `httpOnly` + `SameSite`. Documentado como trabajo futuro.

---

## 14. Tests y CI

```bash
cd backend && npm test                                 # jest 110/110
cd ml_engine && python -m pytest tests -q              # pytest 7/7
```

**backend (jest + supertest)** — sin dependencias externas: Prisma y el fetch al motor ML están mockeados; `server.js` exporta la app sin `listen`:
- Bloqueo descarte ≥ 60% → 400 con mensaje "demasiado alta"
- Campos faltantes/inválidos en predict → 400 (zod); sin flete marítimo en el desglose; agenciamiento/SLI en USD por defecto y PEN convertido
- Predicción válida → 200 con `estimacion_pre_compra` y `cotizacion_sugerida`
- Sin token → 401 · Login inválido → 401 · Login sin credenciales → 400 · login de cliente (tabla `clientes`) → `role: CLIENTE`
- POST y PATCH de cotizaciones con rol AUDITOR → 403 · Datos inválidos → 400 · sin `departamentoId` → 400 · en un rubro sin acceso → 403
- `/api/usuarios` (crear/actualizar/asignar rubros) exclusivo ADMIN
- `/api/clientes`: GET (ADMIN+MANAGER, con `tieneAcceso` derivado sin exponer el hash), POST alta rápida (409 email duplicado, 400 sin email, 403 AUDITOR), PATCH `/activar-acceso` (ADMIN, 403 MANAGER, 400 password corto, 404 inexistente)
- `/api/productos` y `/api/destinos`: listar (cualquiera), crear/actualizar (ADMIN, 409 nombre duplicado, 404 inexistente)
- `/api/departamentos` (catálogo, ADMIN) y `/mios` (ADMIN/AUDITOR ven todos, MANAGER solo lo asignado)
- `/api/notificaciones`: listar con conteo de no leídas, marcar una/todas, 404 si la notificación no es propia
- `/api/tipo-cambio`: fecha inválida → 400, fallo de SUNAT → 503, 429 de SUNAT → 503 con mensaje específico, consulta histórica
- `/api/ml/categorias`: 200 con clases del motor, 401 sin token, 503 con motor caído
- `/api/cotizaciones` con `clienteId` opcional al crear; `GET` con rol CLIENTE fuerza `where.clienteId = self` sin pasar por la lógica de rubros
- `POST`/`PATCH /api/cotizaciones` con borrador mínimo (solo producto/destino/departamentoId) y campos nullable; `GET /:id` (200, 404, 403 por rubro, 404 para CLIENTE ajeno); `PATCH /:id` reemplaza gastos, 409 si ya LIQUIDADA
- `PATCH /:id/liquidar`: calcula `precioVentaReal`/`precioFobCajaReal` desde `utilidadRealPct` (validado contra el CNT 01 real: 19.34 USD/caja), 400 si falta cualquier componente obligatorio del costo (los nombra)
- `GET /api/cotizaciones/gastos-habituales`: línea base sin histórico suficiente, frecuencia + `estadisticasMonto` (mediana/MAD) con histórico real, conversión PEN→USD por cotización y descarte de filas sin tipo de cambio, 403 sin rol ADMIN/MANAGER

**ml_engine (pytest)** — `conftest.py` inyecta un modelo mínimo en el caché (no depende del pkl, que está gitignored):
- Producto/destino desconocido → ValueError
- Descarte siempre ∈ [0,1]
- `/predict` con API key inválida → 401 · con key válida → 200
- `/categorias`: 200 con las clases entrenadas del modelo · 401 con key inválida

**CI**: `.github/workflows/ci.yml` — jobs `pytest` (Python 3.12) y `jest` (Node 22 + `npx prisma generate`) en cada push/PR. ⚠ Aún sin remoto configurado: el workflow corre recién al hacer push a GitHub. Nota: `backend/package-lock.json` fue regenerado en Linux (bug de npm en Windows con optional deps wasm rompía `npm ci`); si se reinstala en Windows y `npm ci` falla en CI/Docker, regenerar con `docker run --rm -v ${PWD}\backend:/app -w /app node:22-alpine npm install --package-lock-only`.

---

## 15. Pendientes conocidos

| # | Pendiente | Dónde | Acción |
|---|---|---|---|
| 1 | ~~13 registros reales del Excel~~ **HECHO** (13 CNT cargados, dataset = 63 como declara la tesis, modelo reentrenado) | `seed.js` → `OPERACIONES_REALES` | Mejorable: descarte real de CNT 10-12 (hoy 0 provisional) y confirmar el descarte de CNT 06 (idéntico a CNT 05, posible copy-paste) |
| 2 | Rotar secretos de desarrollo | `backend/.env` | Ver §13 |
| 3 | Push a GitHub para activar CI | remoto git | `git push` (remoto ya configurado) |
| 4 | Pantallas stub: Reportes (admin/auditor) | `frontend/src/pages/` | Fuera del alcance evaluado de la tesis (no agregar antes de la defensa). Portal Cliente ya no es stub — ver §12.7 |
| 5 | Actualizar la tesis con las cifras reales | documento (Cowork) | Ver checklist detallado abajo (§15.1) |
| 6 | Notificaciones sin tiempo real | `NotificationBell.jsx` | Polling cada 60 s (suficiente para el volumen actual); si se necesita instantáneo, migrar a WebSockets/SSE |
| 7 | Rubros sin funcionalidad de negocio propia | Importaciones, Automotriz, Logística, Transporte, Telecom | Deliberadamente fuera de alcance: solo muestran un Dashboard genérico; no inventar módulos sin pedido explícito |
| 8 | Gastos habituales / anomalías de monto sin histórico real todavía | `cotizacionesController.js` → `gastosHabituales` | Los 13 CNT reales no tienen gastos desglosados por concepto; ambas analíticas (§9.8) operan en modo "línea base"/sin señal hasta que el ERP acumule ≥5 cotizaciones liquidadas con ese gasto desde su propio uso — no requiere acción, es el comportamiento esperado |
| 9 | Preguntas de negocio sin responder (comparando CNT 01 real vs. lo que el sistema captura) | Excel histórico | ~~MAQUILA (tarifa/caja vs. total)~~ y ~~multiplicador 0.35 en "Alquiler de jabas"~~ **RESUELTOS** — la planta cobra por caja (ya modelado bien) y el "0.35" es simplemente el precio unitario por jaba alquilada (cantidad × p.u., según el propio encabezado del Excel en 8 de las 13 hojas) — ambos ya entran al sistema como un total plano (gasto adicional), sin cambios necesarios. Sin resolver: (a) desfase de $2,355.92 en materia prima del CNT 01 — contexto conocido (falla del recolector de cosecha, ~6,000 kg de descarte extra) pero monto exacto **no reconciliable** con el detalle disponible del Excel (solo hay precio promedio ponderado, no precio por camión); (b) "cajas por contenedor" vs. "cajas enviadas" tratadas como una sola; (c) fechas de cosecha en texto ambiguo (ej. "28/29/ Abril"); (d) momento de registrar la venta pactada (O/C) |
| 10 | Alerta de "montos descuadrados" (dos cálculos del mismo componente que no coinciden) | Idea para `cotizacionesController.js` / §9.8 | Nace del caso anterior: cuando un costo se puede derivar de dos formas independientes (ej. materia prima por kg×precio vs. un total ingresado a mano) y ambas no coinciden más allá de un umbral, el sistema podría advertir en el momento en vez de descubrirse meses después al auditar. Distinto de la detección de anomalías ya existente (§9.8, que compara UN monto contra su propio histórico) — esto compararía DOS fuentes del mismo dato entre sí. No implementado — requiere decidir qué componentes admiten doble cálculo y el umbral de tolerancia |

### 15.1 Checklist para actualizar el documento de tesis (rescatado de ROADMAP.md, eliminado)

**Secciones a editar con las cifras/decisiones reales del código:**
- **3.9**: criterio de optimización = **MAE** (no RMSE) — coincide con el argumento de legibilidad de 2.4.5 (MAE es directamente interpretable como puntos de descarte).
- **3.13.1**: tablas reales del modelo de datos — `usuarios`, `clientes`, `productos`, `destinos`, `cotizaciones` (con los campos de §7 del modelo Prisma arriba), `gastos_cotizacion`, `departamentos`, `usuario_departamentos`, `notificaciones` (no "contenedores" ni "componentes de costo" como conceptos aparte).
- **1.5.2, 2.3.5, Anexo 7**: roles → **ADMIN / MANAGER / AUDITOR** (+ portal **CLIENTE**), acceso por rubro vía `usuario_departamentos`.
- **"Latencia ~500 ms"**: reemplazar por la latencia real medida con `performance.now()` en el cotizador (visible en pantalla junto al resultado de cada predicción).
- **Modelo ganador y métricas**: verificar con `GET /api/ml/health` o `ml_engine/model/train_output.txt` cuál modelo quedó serializado (hoy: Gradient Boosting, MAE=0.0227, R²=0.6256 sobre 63 registros) y alinear el Capítulo IV — **las cifras que salgan de `train.py` son las que van a la tesis, no al revés** (si dan distinto de lo ya escrito, se corrige el documento).
- **Anexo 8** (endpoints): agregar los nuevos — `GET/PATCH /api/cotizaciones/:id`, `GET /api/cotizaciones/gastos-habituales`, `/api/productos`, `/api/destinos`, `/api/clientes` (con alta rápida + activar acceso).

**Capturas para el Anexo 9** (orden sugerido para contar la historia completa): landing → login → dashboard por rol → selector de rubro → formulario de cotización con predicción en vivo (precio FOB por caja) → el bloqueo del 60% en pantalla → alerta de componente de costo/gasto habitual faltante → guardado automático del borrador (`?borrador=` en la URL) → historial con "Continuar editando" → modal de liquidación → catálogo de productos/destinos (`/admin/catalogo`) → alta rápida de cliente + activar acceso → portal del cliente → salida de consola de `train.py` → `GET /api/ml/health` → docs automáticas de FastAPI (`http://localhost:8000/docs`) → gráfico de importancia de variables.

---

## Licencia

Uso interno — Frutransport S.A.C. © 2026
