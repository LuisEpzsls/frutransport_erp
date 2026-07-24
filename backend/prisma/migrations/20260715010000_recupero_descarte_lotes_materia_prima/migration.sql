-- AlterTable: recupero por venta de descarte, campo dedicado (reemplaza el
-- gasto adicional "Recupero por venta de descarte (negativo)").
ALTER TABLE "cotizaciones" ADD COLUMN     "recupero_descarte" DOUBLE PRECISION,
ADD COLUMN     "recupero_descarte_moneda" "moneda";

-- CreateTable: desglose de la compra de materia prima por lote/camión.
CREATE TABLE "lotes_materia_prima" (
    "id" SERIAL NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cotizacion_id" INTEGER NOT NULL,

    CONSTRAINT "lotes_materia_prima_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "lotes_materia_prima" ADD CONSTRAINT "lotes_materia_prima_cotizacion_id_fkey" FOREIGN KEY ("cotizacion_id") REFERENCES "cotizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
