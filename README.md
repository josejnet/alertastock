# AlertaStock

AlertaStock es una aplicación web de escritorio para gestionar una reserva de alimentos y equipamiento de emergencia. Permite saber qué se quiere tener, qué se ha comprado, qué se ha consumido, dónde está cada lote y cuántos días de autonomía puede cubrir el hogar.

## Capturas de pantalla

### Acceso

![Pantalla de acceso de AlertaStock](public/screenshots/login.jpg)

### Resumen operativo

![Resumen operativo de AlertaStock](public/screenshots/dashboard.jpg)

### Autonomía nutricional

![Módulo de autonomía nutricional](public/screenshots/autonomia.jpg)

### Inventario

![Módulo de inventario](public/screenshots/inventario.jpg)

## Qué hace

AlertaStock separa la planificación de la existencia real:

1. **Stock a completar** define el objetivo de cada alimento: por ejemplo, 25 kg de pasta.
2. **Lista de compra** propone únicamente artículos que todavía tienen unidades pendientes.
3. **Inventario** registra las compras reales. La caducidad es obligatoria y el detalle es opcional: `macarrones`, `fideos`, marca o formato.
4. **Consumos** descuenta unidades de lotes concretos. Lo consumido vuelve a aparecer como pendiente de compra.
5. **Packs y lotes** agrupan compras concretas en cajas o ubicaciones. Crear un pack no reduce el stock; solo añade trazabilidad.
6. **Calendario** resume los artículos que caducan en 3, 6 y 9 meses, con su pack y localización.
7. **PDF** genera un informe de caducidades con esa misma información.
8. **Autonomía** calcula días de cobertura por calorías, proteínas, hidratos y grasas. La cifra prudente queda limitada por el nutriente que se agota antes y aplica un margen operativo del 15%.
9. **Equipamiento** es un módulo independiente para altas y gestión de material no alimentario: hornillo, gas, linternas, pilas, agua, botiquín y herramientas.
10. **Revisar datos** localiza compras sin detalle o información incompleta para poder corregirlas.

### Flujo recomendado

```text
Definir stock objetivo → Generar lista de compra → Registrar compra con caducidad
→ Organizar en pack/localización → Consumir cuando corresponda
→ Revisar pendientes, caducidades y autonomía
```

El catálogo base se inspira en una reserva alimentaria de larga duración y contiene categorías, alimentos y equipamiento mínimo. El usuario puede modificar el stock, las cantidades, las categorías y el catálogo permitido desde Configuración.

## Roles

- **Superadmin**: gestiona usuarios, estados de cuenta, categorías globales y métricas administrativas desde `/admin`.
- **Usuario estándar**: tiene un espacio aislado para su stock, compras, consumos, packs, hogar y configuración.

## Autonomía nutricional

En **Mi hogar** se registran los habitantes y su edad. En **Configuración** se pueden ajustar las calorías diarias de cada tramo de edad.

La estimación nutricional utiliza valores medios del catálogo y un reparto inicial de referencia:

- 20% de energía procedente de proteínas.
- 50% de energía procedente de hidratos.
- 30% de energía procedente de grasas.

Son valores de planificación, no una recomendación médica. Para mayor precisión hay que contrastar las etiquetas de los productos concretos.

## Stack técnico

- Next.js 16 con App Router y TypeScript.
- React 19.
- Tailwind CSS 4 y Lucide React.
- Prisma 6 y PostgreSQL, preparado para Neon o Supabase.
- Route Handlers para autenticación, workspace y administración.
- `@react-pdf/renderer` para informes PDF.
- Resend y Vercel Cron preparados para una fase posterior de alertas por email.
- Tests de arquitectura con Node Test Runner.

## Requisitos

- Node.js 20 o superior.
- npm.
- PostgreSQL 14 o superior para persistencia completa.
- Git.

## Instalación local

### 1. Descargar el proyecto

```bash
git clone https://github.com/josejnet/alertastock.git
cd alertastock
npm install
```

### 2. Configurar variables de entorno

En Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

En macOS/Linux:

```bash
cp .env.example .env
```

Edita `.env` y completa al menos:

```env
DATABASE_URL="postgresql://usuario:contraseña@host:5432/reserva_clara"
AUTH_SECRET="una-clave-larga-y-aleatoria"
ADMIN_USER="admin"
ADMIN_PASSWORD="una-contraseña-segura"
JOSE_USER="jose"
JOSE_PASSWORD="otra-contraseña-segura"
```

No subas `.env` ni `.env.local` a GitHub. Están excluidos por `.gitignore`.

### 3. Preparar Prisma y PostgreSQL

Para un entorno local nuevo:

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

El seed crea los usuarios definidos por `ADMIN_PASSWORD` y `JOSE_PASSWORD`, el catálogo base, las categorías y el stock objetivo. No contiene contraseñas por defecto.

Si estás desarrollando una modificación del esquema:

```bash
npx prisma migrate dev --name nombre-del-cambio
```

### 4. Arrancar la aplicación

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

Otros comandos:

```bash
npm run build   # compilación de producción
npm start       # servir la compilación
npm run lint    # comprobar calidad del código
npm test        # ejecutar tests de arquitectura
```

## Despliegue en Vercel

1. Importa el repositorio desde Vercel.
2. Añade una base PostgreSQL desde Neon, Supabase u otro proveedor.
3. Configura en Vercel `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD`, `JOSE_PASSWORD`, `ADMIN_USER` y `JOSE_USER`.
4. Despliega el proyecto.
5. Ejecuta las migraciones contra la base de producción:

```bash
npx prisma migrate deploy
npx prisma db seed
```

Comprueba el estado de la base en `/api/health`.

## Cron de correos

El endpoint `/api/cron/expiry-alerts` está separado de la API principal y preparado para Resend. La funcionalidad de correo permanece deliberadamente pendiente hasta configurar `RESEND_API_KEY`, `EMAIL_FROM` y `CRON_SECRET` y autorizar esa fase.

## Seguridad y datos

- Los datos del workspace se filtran por usuario en las consultas Prisma.
- Las contraseñas se almacenan mediante hash `bcrypt` cuando se usa PostgreSQL.
- El repositorio público no contiene secretos ni credenciales reales.
- Las compras exigen fecha de caducidad.
- Los artículos de inventario deben pertenecer previamente al stock a completar.
- El endpoint de salud no expone datos del inventario.

## Estado del proyecto

La aplicación está desplegada en Vercel y la base PostgreSQL de producción está conectada. El cron de emails es la única pieza dejada intencionadamente para una fase posterior.
