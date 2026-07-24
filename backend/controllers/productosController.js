const { PrismaClient } = require('@prisma/client');
const { crearControladorCatalogo } = require('../services/catalogoSimple');

const prisma = new PrismaClient();

module.exports = crearControladorCatalogo(prisma.producto, 'producto');
