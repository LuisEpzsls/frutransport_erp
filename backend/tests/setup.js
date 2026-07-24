// Entorno mínimo para los tests: el server hace fail-fast sin JWT_SECRET.
process.env.JWT_SECRET = 'secreto-solo-para-tests';
process.env.NODE_ENV = 'test';
