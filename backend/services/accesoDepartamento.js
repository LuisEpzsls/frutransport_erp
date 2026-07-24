// Acceso por rubro (departamento): ADMIN y AUDITOR operan/auditan todos los
// departamentos sin necesidad de asignación explícita (ADMIN administra,
// AUDITOR audita de punta a punta); MANAGER solo los que tenga asignados en
// usuario_departamentos.
const ROLES_SIN_RESTRICCION = ['ADMIN', 'AUDITOR'];

/** IDs de departamento que el usuario puede operar. `null` = todos (sin restricción). */
async function departamentosDeUsuario(prisma, usuario) {
  if (ROLES_SIN_RESTRICCION.includes(usuario.role)) return null;
  const filas = await prisma.usuarioDepartamento.findMany({
    where: { usuarioId: usuario.id },
    select: { departamentoId: true },
  });
  return filas.map((f) => f.departamentoId);
}

async function tieneAccesoDepartamento(prisma, usuario, departamentoId) {
  if (ROLES_SIN_RESTRICCION.includes(usuario.role)) return true;
  const fila = await prisma.usuarioDepartamento.findUnique({
    where: { usuarioId_departamentoId: { usuarioId: usuario.id, departamentoId } },
  });
  return !!fila;
}

module.exports = { departamentosDeUsuario, tieneAccesoDepartamento };
