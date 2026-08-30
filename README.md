# Waypoint Content OS

CMS agent-first inspirado en WordPress: tipos de contenido, metadatos, taxonomías, términos, relaciones, usuarios, roles, plugins declarativos, hooks y acciones WebMCP.

## Autenticación y correo

El primer acceso solicita crear el usuario administrador. Las contraseñas se derivan con PBKDF2-SHA-256 y las sesiones se almacenan como hashes en D1 mediante una cookie `HttpOnly`.

Para habilitar notificaciones por Resend, configura los secretos en Wrangler sin subirlos al repositorio:

```bash
npx wrangler secret put RESEND_API_KEY --config wrangler.jsonc
npx wrangler secret put RESEND_FROM_EMAIL --config wrangler.jsonc
npx wrangler deploy --config wrangler.jsonc
```

`RESEND_FROM_EMAIL` debe usar un remitente o dominio verificado en Resend, por ejemplo `Waypoint <notificaciones@tu-dominio.com>`.
