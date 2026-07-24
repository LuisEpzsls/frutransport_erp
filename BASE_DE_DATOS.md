# Base de datos — diagrama actual

Fuente única de verdad: `backend/prisma/schema.prisma`. 10 tablas, PostgreSQL.

```mermaid
erDiagram
    USUARIOS ||--o{ COTIZACIONES : crea
    USUARIOS ||--o{ USUARIO_DEPARTAMENTOS : "tiene acceso a"
    USUARIOS ||--o{ NOTIFICACIONES : recibe
    DEPARTAMENTOS ||--o{ USUARIO_DEPARTAMENTOS : "asignado en"
    DEPARTAMENTOS ||--o{ COTIZACIONES : agrupa
    CLIENTES ||--o{ COTIZACIONES : "es dueño de"
    COTIZACIONES ||--o{ GASTOS_COTIZACION : desglosa
    COTIZACIONES ||--o{ LOTES_MATERIA_PRIMA : desglosa
    COTIZACIONES ||--o{ LOTES_DESCARTE_VENDIDO : desglosa

    USUARIOS {
        uuid id PK
        string email UK
        string password_hash
        enum role "ADMIN/MANAGER/AUDITOR"
        bool activo
    }
    CLIENTES {
        uuid id PK
        string nombre_completo
        string email UK
        string password_hash "null = sin acceso al portal"
        bool verificado
    }
    DEPARTAMENTOS {
        int id PK
        string nombre UK
        string slug UK
        int orden
    }
    USUARIO_DEPARTAMENTOS {
        int id PK
        uuid usuario_id FK
        int departamento_id FK
    }
    PRODUCTOS {
        int id PK
        string nombre UK
        bool activo
    }
    DESTINOS {
        int id PK
        string nombre UK
        bool activo
    }
    COTIZACIONES {
        int id PK
        string producto
        string destino
        enum estado "PENDIENTE-APROBADA-LIQUIDADA-RECHAZADA"
        float costo_total_estimado
        float costo_total_real
        float valor_venta_oc "pactado, al aprobar"
        float valor_venta_factura "real, al liquidar"
        int numero_contenedor_general "asignado al aprobar"
        int numero_contenedor_cliente
        uuid usuario_id FK
        uuid cliente_id FK
        int departamento_id FK
    }
    GASTOS_COTIZACION {
        int id PK
        string concepto
        float monto "negativo = recupero"
        enum moneda
        int cotizacion_id FK
    }
    LOTES_MATERIA_PRIMA {
        int id PK
        string etiqueta "p.ej. Primer camion"
        float kg
        int cotizacion_id FK
    }
    LOTES_DESCARTE_VENDIDO {
        int id PK
        float kg
        float precio_kg
        enum moneda
        int cotizacion_id FK
    }
    NOTIFICACIONES {
        int id PK
        uuid usuario_id FK
        string tipo
        bool leida
    }
```

## Explicación rápida

- **`usuarios`**: cuentas internas del ERP (ADMIN/MANAGER/AUDITOR). `usuario_departamentos` define qué rubros administra cada uno (ADMIN/AUDITOR no necesitan fila, tienen acceso implícito a todo).
- **`clientes`**: portal externo. `password_hash` nullable — un cliente puede existir solo como registro de seguimiento (creado desde el cotizador) hasta que un ADMIN le "activa acceso".
- **`departamentos`**: los rubros del holding (Agroexportación, Importaciones, etc.) — hoy solo Agroexportación tiene funcionalidad real.
- **`productos` / `destinos`**: catálogo editable del cotizador (independiente de las categorías con las que el modelo ML fue entrenado).
- **`cotizaciones`**: la tabla central — es a la vez la cotización (estimado) y, una vez aprobada, el contenedor real. Vive en un pipeline de estados:
  `PENDIENTE` (editable, autoguardado) → `APROBADA` (se numera como contenedor, ya no editable) → `LIQUIDADA` (valores reales de cierre). `reabrir` puede devolverla un paso atrás.
  Guarda todo el ciclo de costos (materia prima, maquila, agenciamiento, SLI, recupero de descarte), la venta real vs. pactada, y la trazabilidad de logística (booking, fechas, contenedor de la naviera).
- **`gastos_cotizacion`**: gastos variables de cada operación (fletes, jabas, supervisión…), lista abierta por cotización.
- **`lotes_materia_prima`** / **`lotes_descarte_vendido`**: desgloses informativos (compra de fruta por camión; venta de descarte por kg×precio) — no cambian el costo, solo trazabilidad y verificación cruzada.
- **`notificaciones`**: se generan al crear/liquidar una cotización, propia por usuario.

**3 enums**: `rol_erp` (ADMIN/MANAGER/AUDITOR), `estado_cot` (PENDIENTE/APROBADA/EN_TRANSITO/LIQUIDADA/RECHAZADA), `moneda` (PEN/USD).
