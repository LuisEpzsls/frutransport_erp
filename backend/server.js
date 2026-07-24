const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv    = require('dotenv');

dotenv.config();

// JWT_SECRET es obligatorio: sin él no se pueden firmar ni verificar tokens.
if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET no está definido en backend/.env — el servidor no puede arrancar.');
  process.exit(1);
}

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middlewares ────────────────────────────────────────────────────────────────
app.use(helmet());
// En producción, el origen real se toma de CORS_ORIGIN (uno o varios,
// separados por coma) — nunca un dominio de ejemplo hardcodeado. Si falta,
// no se abre a nadie por accidente (fail-closed) en vez de bloquear a todos
// con un dominio inventado que nunca hará match.
const corsOrigin = process.env.NODE_ENV === 'production'
  ? (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : false)
  : ['http://localhost:5173', 'http://localhost:3000'];
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  console.warn('[WARN] CORS_ORIGIN no está definido en producción — todas las peticiones cross-origin del navegador serán rechazadas.');
}
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Logging básico de requests ─────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Rutas ──────────────────────────────────────────────────────────────────────
const authRoutes    = require('./routes/auth');
const mlRoutes      = require('./routes/ml');
const cotizRoutes   = require('./routes/cotizaciones');
const tipoCambioRoutes = require('./routes/tipoCambio');
const usuariosRoutes = require('./routes/usuarios');
const clientesRoutes = require('./routes/clientes');
const departamentosRoutes = require('./routes/departamentos');
const notificacionesRoutes = require('./routes/notificaciones');
const productosRoutes = require('./routes/productos');
const destinosRoutes = require('./routes/destinos');

// Rate limit anti fuerza bruta: 10 intentos de login por IP cada 15 min
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true, // solo cuentan los intentos fallidos
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.' },
});

app.use('/api/auth/login',   loginLimiter);
app.use('/api/auth',         authRoutes);
app.use('/api/ml',           mlRoutes);
app.use('/api/cotizaciones', cotizRoutes);
app.use('/api/tipo-cambio', tipoCambioRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/departamentos', departamentosRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/destinos', destinosRoutes);

// Health check — primer endpoint para verificar que el servidor vive
app.get('/api/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'Frutransport ERP — Backend',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || 'development',
  });
});

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ── Error handler global ───────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error:   err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ── Arrancar (solo si se ejecuta directamente; los tests importan la app) ──────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  Frutransport ERP Backend`);
    console.log(`  Puerto  : http://localhost:${PORT}`);
    console.log(`  Health  : http://localhost:${PORT}/api/health`);
    console.log(`  Env     : ${process.env.NODE_ENV || 'development'}\n`);
  });
}

module.exports = app;
