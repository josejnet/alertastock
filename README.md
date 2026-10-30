# ReservaClara

Panel de escritorio para gestionar una reserva de alimentos, caducidades, packs y autonomía familiar.

## Cómo funciona

ReservaClara separa la planificación de la existencia real:

1. **Stock a completar** define cuánto quieres tener de cada alimento.
2. **Lista de compra** contiene solo artículos cuyo objetivo todavía no está completo.
3. **Inventario** registra cada compra real, siempre con fecha de caducidad obligatoria y detalle opcional (por ejemplo, "macarrones").
4. **Consumos** descuenta unidades del inventario y devuelve esa cantidad a la compra pendiente.
5. **Packs y lotes** agrupan compras concretas por caja, código y ubicación sin reducir el stock.
6. **Calendario y PDF** resumen lo que caduca a 3, 6 y 9 meses, incluyendo pack y localización.
7. **Autonomía** calcula días de energía y cobertura de proteínas, hidratos y grasas según los habitantes del hogar.
8. **Equipamiento** mantiene un inventario separado para hornillo, gas, iluminación, agua, botiquín y material auxiliar.

Los valores nutricionales son estimaciones medias por alimento y unidad del catálogo. Para un cálculo específico deben contrastarse con la etiqueta del producto. El repositorio no contiene contraseñas ni variables de entorno reales.

## Estado actual

- Dashboard de escritorio en español con diseño responsive.
- Inventario, compras, packs, hogar, autonomía y catálogo con respaldo local durante la transición y API persistente cuando PostgreSQL está configurado.
- Métricas de autonomía nutricional y alertas visuales.
- Esquema Prisma/PostgreSQL con usuarios, roles, categorías jerárquicas, inventario, lista de compra seleccionable, packs, miembros del hogar y entregas idempotentes de alertas.
- Endpoint `/api/health`.
- Endpoint `/api/cron/expiry-alerts` preparado para Resend, reservado para la última fase y no activado funcionalmente todavía.
- Configuración de Vercel Cron diaria en `vercel.json`; no modificar ni probar hasta autorizar la fase de correo.
- Importación automática de una sola vez desde las claves localStorage existentes cuando la sesión ya tiene PostgreSQL disponible.

## Desarrollo

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name initial
npm run dev
```

Para validar el proyecto sin conectar todavía a una base de datos:

```bash
npm run build
```

Para inicializar una base PostgreSQL:

```bash
npx prisma migrate deploy
npx prisma db seed
```

Antes de ejecutar el seed, define `ADMIN_PASSWORD` y `JOSE_PASSWORD` en tu entorno. El seed no incluye contraseñas por defecto.

Vercel tiene provisionado Neon y las migraciones actuales (`0001_initial`, `0002_add_item_detail`, `0003_shopping_list_planned_stock`) ya están aplicadas. `AUTH_SECRET` está configurado en producción y desarrollo. Para nuevos entornos, configura `DATABASE_URL` y `AUTH_SECRET`. Para la fase posterior de correo se añadirán `RESEND_API_KEY`, `EMAIL_FROM` y `CRON_SECRET`.

## Pendiente de infraestructura

La aplicación ya tiene Route Handlers autenticados y CRUD Prisma para el espacio de usuario y la administración. La base PostgreSQL de Neon está conectada a Vercel, con migraciones y seed ejecutados. El cron de correo permanece deliberadamente pendiente y no se activa hasta autorizar esa fase.
