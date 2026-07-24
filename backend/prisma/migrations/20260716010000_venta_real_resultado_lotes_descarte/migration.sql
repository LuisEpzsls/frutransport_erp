-- AlterTable: venta real (pactada en O/C, luego facturada de verdad) — la
-- única forma de saber si un contenedor ganó o perdió dinero de verdad, no
-- solo si el costo estimado se acercó al real. + tercera fecha logística
-- (llenado/despacho de planta).
ALTER TABLE "cotizaciones" ADD COLUMN     "fecha_llenado_despacho" TIMESTAMP(3),
ADD COLUMN     "valor_venta_factura" DOUBLE PRECISION,
ADD COLUMN     "valor_venta_factura_moneda" "moneda",
ADD COLUMN     "valor_venta_oc" DOUBLE PRECISION,
ADD COLUMN     "valor_venta_oc_moneda" "moneda";

-- CreateTable: desglose de la venta del descarte por lote (kg × precio),
-- se suma automáticamente al campo dedicado recupero_descarte.
CREATE TABLE "lotes_descarte_vendido" (
    "id" SERIAL NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "precio_kg" DOUBLE PRECISION NOT NULL,
    "moneda" "moneda" NOT NULL DEFAULT 'PEN',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cotizacion_id" INTEGER NOT NULL,

    CONSTRAINT "lotes_descarte_vendido_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "lotes_descarte_vendido" ADD CONSTRAINT "lotes_descarte_vendido_cotizacion_id_fkey" FOREIGN KEY ("cotizacion_id") REFERENCES "cotizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
