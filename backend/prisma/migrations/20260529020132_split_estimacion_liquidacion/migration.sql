/*
  Warnings:

  - The values [FACTURADA] on the enum `estado_cot` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `costo_estimado` on the `cotizaciones` table. All the data in the column will be lost.
  - You are about to drop the column `costo_real` on the `cotizaciones` table. All the data in the column will be lost.
  - Added the required column `peso_neto_caja` to the `cotizaciones` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "estado_cot_new" AS ENUM ('PENDIENTE', 'APROBADA', 'EN_TRANSITO', 'LIQUIDADA', 'RECHAZADA');
ALTER TABLE "cotizaciones" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "cotizaciones" ALTER COLUMN "estado" TYPE "estado_cot_new" USING ("estado"::text::"estado_cot_new");
ALTER TYPE "estado_cot" RENAME TO "estado_cot_old";
ALTER TYPE "estado_cot_new" RENAME TO "estado_cot";
DROP TYPE "estado_cot_old";
ALTER TABLE "cotizaciones" ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE';
COMMIT;

-- AlterTable
ALTER TABLE "cotizaciones" DROP COLUMN "costo_estimado",
DROP COLUMN "costo_real",
ADD COLUMN     "costo_total_estimado" DOUBLE PRECISION,
ADD COLUMN     "costo_total_real" DOUBLE PRECISION,
ADD COLUMN     "peso_neto_caja" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "porcentaje_descarte_estimado" DOUBLE PRECISION,
ADD COLUMN     "porcentaje_descarte_real" DOUBLE PRECISION;
