-- CreateEnum
CREATE TYPE "rol_erp" AS ENUM ('ADMIN', 'MANAGER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "estado_cot" AS ENUM ('PENDIENTE', 'APROBADA', 'EN_TRANSITO', 'LIQUIDADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "moneda" AS ENUM ('PEN', 'USD');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "rol_erp" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_departamentos" (
    "id" SERIAL NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "departamento_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_departamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "empresa" TEXT,
    "pais" TEXT,
    "telefono" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destinos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "destinos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotizaciones" (
    "id" SERIAL NOT NULL,
    "producto" TEXT NOT NULL,
    "variedad" TEXT,
    "volumen_ton" DOUBLE PRECISION,
    "destino" TEXT NOT NULL,
    "tipo_cargamento" TEXT,
    "peso_neto_caja" DOUBLE PRECISION,
    "precio_mp_kg" DOUBLE PRECISION,
    "cajas_contenedor" INTEGER,
    "kg_cosecha_comprados" DOUBLE PRECISION,
    "costo_maquila" DOUBLE PRECISION,
    "costo_agenciamiento" DOUBLE PRECISION,
    "costo_agenciamiento_moneda" "moneda",
    "costo_sli" DOUBLE PRECISION,
    "costo_sli_moneda" "moneda",
    "recupero_descarte" DOUBLE PRECISION,
    "recupero_descarte_moneda" "moneda",
    "tipo_cambio" DOUBLE PRECISION,
    "mes" INTEGER,
    "porcentaje_descarte_estimado" DOUBLE PRECISION,
    "porcentaje_descarte_real" DOUBLE PRECISION,
    "costo_total_estimado" DOUBLE PRECISION,
    "costo_total_real" DOUBLE PRECISION,
    "utilidad_pct" DOUBLE PRECISION,
    "precio_venta_estimado" DOUBLE PRECISION,
    "precio_fob_caja_estimado" DOUBLE PRECISION,
    "utilidad_real_pct" DOUBLE PRECISION,
    "precio_venta_real" DOUBLE PRECISION,
    "precio_fob_caja_real" DOUBLE PRECISION,
    "numero_booking" TEXT,
    "fecha_cosecha_inicio" TIMESTAMP(3),
    "fecha_cosecha_fin" TIMESTAMP(3),
    "fecha_procesamiento" TIMESTAMP(3),
    "fecha_llenado_despacho" TIMESTAMP(3),
    "numero_contenedor_logistica" TEXT,
    "valor_venta_oc" DOUBLE PRECISION,
    "valor_venta_oc_moneda" "moneda",
    "valor_venta_factura" DOUBLE PRECISION,
    "valor_venta_factura_moneda" "moneda",
    "numero_contenedor_general" INTEGER,
    "numero_contenedor_cliente" INTEGER,
    "estado" "estado_cot" NOT NULL DEFAULT 'PENDIENTE',
    "notas" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "usuario_id" TEXT,
    "cliente_id" TEXT,
    "departamento_id" INTEGER NOT NULL,

    CONSTRAINT "cotizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos_cotizacion" (
    "id" SERIAL NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "moneda" "moneda" NOT NULL DEFAULT 'PEN',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cotizacion_id" INTEGER NOT NULL,

    CONSTRAINT "gastos_cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes_materia_prima" (
    "id" SERIAL NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cotizacion_id" INTEGER NOT NULL,

    CONSTRAINT "lotes_materia_prima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes_descarte_vendido" (
    "id" SERIAL NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "precio_kg" DOUBLE PRECISION NOT NULL,
    "moneda" "moneda" NOT NULL DEFAULT 'PEN',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cotizacion_id" INTEGER NOT NULL,

    CONSTRAINT "lotes_descarte_vendido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departamentos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" SERIAL NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "link" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_departamentos_usuario_id_departamento_id_key" ON "usuario_departamentos"("usuario_id", "departamento_id");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_email_key" ON "clientes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "productos_nombre_key" ON "productos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "destinos_nombre_key" ON "destinos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "departamentos_nombre_key" ON "departamentos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "departamentos_slug_key" ON "departamentos"("slug");

-- CreateIndex
CREATE INDEX "notificaciones_usuario_id_leida_idx" ON "notificaciones"("usuario_id", "leida");

-- AddForeignKey
ALTER TABLE "usuario_departamentos" ADD CONSTRAINT "usuario_departamentos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_departamentos" ADD CONSTRAINT "usuario_departamentos_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_cotizacion" ADD CONSTRAINT "gastos_cotizacion_cotizacion_id_fkey" FOREIGN KEY ("cotizacion_id") REFERENCES "cotizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_materia_prima" ADD CONSTRAINT "lotes_materia_prima_cotizacion_id_fkey" FOREIGN KEY ("cotizacion_id") REFERENCES "cotizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_descarte_vendido" ADD CONSTRAINT "lotes_descarte_vendido_cotizacion_id_fkey" FOREIGN KEY ("cotizacion_id") REFERENCES "cotizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

