const jwt = require('jsonwebtoken');

// Verifica el JWT en el header Authorization: Bearer <token>
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token      = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role }
    next();
  } catch {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
};

// Verifica que el usuario tenga uno de los roles permitidos
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Permisos insuficientes' });
  }
  next();
};

module.exports = { verifyToken, requireRole };
