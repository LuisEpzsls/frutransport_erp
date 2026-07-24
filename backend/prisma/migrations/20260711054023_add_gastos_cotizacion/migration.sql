-- CreateEnum
CREATE TYPE "moneda" AS ENUM ('PEN', 'USD');

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

-- AddForeignKey
ALTER TABLE "gastos_cotizacion" ADD CONSTRAINT "gastos_cotizacion_cotizacion_id_fkey" FOREIGN KEY ("cotizacion_id") REFERENCES "cotizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
