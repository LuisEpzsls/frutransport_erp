-- Nota: columnas nuevas nullable + relajar volumen_ton/tipo_cargamento/
-- peso_neto_caja a NULL para soportar borradores incompletos (autoguardado
-- del cotizador). Puramente aditivo, sin backfill.

-- AlterTable
ALTER TABLE "cotizaciones" ADD COLUMN     "cajas_contenedor" INTEGER,
ADD COLUMN     "costo_agenciamiento" DOUBLE PRECISION,
ADD COLUMN     "costo_agenciamiento_moneda" "moneda",
ADD COLUMN     "costo_maquila" DOUBLE PRECISION,
ADD COLUMN     "costo_sli" DOUBLE PRECISION,
ADD COLUMN     "costo_sli_moneda" "moneda",
ADD COLUMN     "kg_cosecha_comprados" DOUBLE PRECISION,
ADD COLUMN     "mes" INTEGER,
ADD COLUMN     "precio_fob_caja_estimado" DOUBLE PRECISION,
ADD COLUMN     "precio_fob_caja_real" DOUBLE PRECISION,
ADD COLUMN     "precio_venta_estimado" DOUBLE PRECISION,
ADD COLUMN     "precio_venta_real" DOUBLE PRECISION,
ADD COLUMN     "tipo_cambio" DOUBLE PRECISION,
ADD COLUMN     "utilidad_pct" DOUBLE PRECISION,
ADD COLUMN     "utilidad_real_pct" DOUBLE PRECISION,
ALTER COLUMN "volumen_ton" DROP NOT NULL,
ALTER COLUMN "tipo_cargamento" DROP NOT NULL,
ALTER COLUMN "peso_neto_caja" DROP NOT NULL;
