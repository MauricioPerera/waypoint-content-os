# Waypoint Content OS

CMS agent-first inspirado en WordPress. Permite gestionar contenido estructurado desde una interfaz humana o mediante herramientas WebMCP para agentes de IA.

## Capacidades

- Tipos de entrada, campos personalizados, metadatos, términos, taxonomías y relaciones.
- CRUD humano para páginas, plantillas, layouts, usuarios, roles, media, plugins, hooks y acciones.
- Editor visual con bloques de texto, imagen, botón, columnas, divisor, HTML, plantillas y reglas de diseño.
- Administración declarativa de plugins y extensiones con pruebas locales de hooks y acciones.
- Biblioteca Media con URLs externas, subida autenticada a R2, miniaturas de imágenes y eliminación segura.
- WebMCP con herramientas para consultar y modificar el contenido usando la lógica real de la aplicación.
- Autenticación con usuario y contraseña, sesiones HttpOnly almacenadas en D1 y recuperación por correo.

## Arquitectura

- `app/`: interfaz React, editor visual y administración humana.
- `src/mcp/tools.ts`: herramientas WebMCP y operaciones del CMS.
- `src/mcp/register.tsx`: registro defensivo sin nombres duplicados.
- `worker/index.ts`: Worker de Cloudflare, autenticación, API, persistencia y media.
- `migrations/`: esquema y migraciones de Cloudflare D1.
- `wrangler.jsonc`: configuración de Worker, assets, D1 y R2.

La aplicación se sirve desde Cloudflare Workers. El estado estructurado se guarda en D1 y los archivos binarios en R2.

## Desarrollo local

Requisitos: Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

La aplicación local se abre normalmente en `http://localhost:3001/`.

## Validación

La comprobación completa ejecuta lint, TypeScript, build y pruebas de sistema:

```bash
npm test
```

También puede ejecutarse solo la batería de sistema:

```bash
npm run test:system
```

Las pruebas comprueban la unicidad de herramientas WebMCP, el registro defensivo, los bindings D1/R2, el renderizado público y el rechazo de APIs protegidas sin autenticación. Se puede apuntar a otra instalación con `WAYPOINT_BASE_URL`.

## Despliegue en Cloudflare

```bash
npx wrangler deploy --config wrangler.jsonc
```

El despliegue utiliza estas bindings:

- D1: `waypoint-content-os-db`
- R2: `waypoint-content-os-media`

Código fuente: [github.com/MauricioPerera/waypoint-content-os](https://github.com/MauricioPerera/waypoint-content-os)

## Autenticación y correo

El primer acceso permite crear el usuario administrador. Las contraseñas se derivan con PBKDF2-SHA-256 y las sesiones se almacenan como hashes en D1 mediante una cookie `HttpOnly`, `Secure` y `SameSite=Lax`.

Para habilitar notificaciones de recuperación y bienvenida con Resend, configura los secretos sin subirlos al repositorio:

```bash
npx wrangler secret put RESEND_API_KEY --config wrangler.jsonc
npx wrangler secret put RESEND_FROM_EMAIL --config wrangler.jsonc
npx wrangler deploy --config wrangler.jsonc
```

`RESEND_FROM_EMAIL` debe utilizar un remitente o dominio verificado en Resend.

## Seguridad

- Las APIs de estado, registro, usuarios y media requieren sesión autenticada.
- Las claves y secretos se gestionan con Wrangler y no forman parte del código fuente.
- Las subidas están limitadas a 10 MB y a formatos permitidos.
- Las operaciones WebMCP usan las mismas validaciones y persistencia que la interfaz humana.

## Estado del proyecto

El núcleo CMS, el editor visual, el registro WebMCP, la autenticación, la persistencia D1/R2 y los CRUD principales están implementados. La suite automatizada sirve como regresión base para ampliar cobertura funcional y pruebas autenticadas.
