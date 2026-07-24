/*
  Warnings:

  - Made the column `departamento_id` on table `cotizaciones` required. This step will fail if there are existing NULL values in that column.

*/
-- Backfill: cualquier cotización sin departamento pasa a Agroexportación
-- (el único rubro con operaciones hasta ahora) antes de endurecer la columna
-- a NOT NULL. Se asegura la fila aquí porque seed.js corre DESPUÉS de las
-- migraciones (el catálogo de departamentos aún no existe en este punto).
INSERT INTO "departamentos" ("nombre", "slug", "orden")
VALUES ('Agroexportación', 'agroexport', 1)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "cotizaciones"
SET "departamento_id" = (SELECT "id" FROM "departamentos" WHERE "slug" = 'agroexport')
WHERE "departamento_id" IS NULL;

-- DropForeignKey
ALTER TABLE "cotizaciones" DROP CONSTRAINT "cotizaciones_departamento_id_fkey";

-- AlterTable
ALTER TABLE "cotizaciones" ALTER COLUMN "departamento_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
