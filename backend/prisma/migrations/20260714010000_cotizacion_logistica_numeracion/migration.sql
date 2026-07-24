-- AlterTable: trazabilidad de logística (booking, fechas de cosecha/procesamiento,
-- contenedor asignado por el operador logístico) + numeración secuencial
-- (general por rubro y por cliente), asignada una sola vez al crear el borrador.
ALTER TABLE "cotizaciones" ADD COLUMN     "fecha_cosecha_fin" TIMESTAMP(3),
ADD COLUMN     "fecha_cosecha_inicio" TIMESTAMP(3),
ADD COLUMN     "fecha_procesamiento" TIMESTAMP(3),
ADD COLUMN     "numero_booking" TEXT,
ADD COLUMN     "numero_contenedor_cliente" INTEGER,
ADD COLUMN     "numero_contenedor_general" INTEGER,
ADD COLUMN     "numero_contenedor_logistica" TEXT;
