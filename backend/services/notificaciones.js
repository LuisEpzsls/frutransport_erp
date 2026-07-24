// Central de notificaciones: se generan de forma síncrona en el mismo
// request que dispara el evento (sin cola — volumen bajo, no lo justifica).

/** Notifica a ADMIN/MANAGER con acceso al rubro de una cotización nueva. */
async function notificarCotizacionCreada(prisma, cotizacion, creadorId) {
  const destinatarios = await prisma.usuario.findMany({
    where: {
      activo: true,
      id: { not: creadorId },
      OR: [
        { role: 'ADMIN' },
        { role: 'MANAGER', departamentos: { some: { departamentoId: cotizacion.departamentoId } } },
      ],
    },
    select: { id: true },
  });
  if (destinatarios.length === 0) return;

  await prisma.notificacion.createMany({
    data: destinatarios.map((u) => ({
      usuarioId: u.id,
      tipo: 'cotizacion_creada',
      mensaje: `Nueva cotización #${cotizacion.id} registrada (${cotizacion.producto} → ${cotizacion.destino})`,
      link: '/admin/historial',
    })),
  });
}

/** Notifica al creador de la cotización cuando se liquida. */
async function notificarCotizacionLiquidada(prisma, cotizacion, liquidadorId) {
  if (!cotizacion.usuarioId || cotizacion.usuarioId === liquidadorId) return;

  await prisma.notificacion.create({
    data: {
      usuarioId: cotizacion.usuarioId,
      tipo: 'cotizacion_liquidada',
      mensaje: `Tu cotización #${cotizacion.id} fue liquidada (${cotizacion.producto} → ${cotizacion.destino})`,
      link: '/admin/historial',
    },
  });
}

module.exports = { notificarCotizacionCreada, notificarCotizacionLiquidada };
