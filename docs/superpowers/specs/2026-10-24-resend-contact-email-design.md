# Diseño: envío de contactos con Resend

## Intención

Los mensajes enviados desde una ficha profesional deben conservarse en Supabase y generar una notificación transaccional en `pedro.ortega@españalatente.org`. La interfaz solo confirmará el envío cuando Resend haya aceptado el correo, y permitirá responder al remitente mediante `Reply-To`.

## Objetivos

- Mover el envío del formulario a una función de servidor de TanStack Start desplegada en Vercel.
- Validar y limitar todos los campos en el servidor; el navegador no tendrá acceso a secretos.
- Mantener `contact_messages` como registro de respaldo.
- Enviar desde `Directorio audiovisual <contacto@españalatente.org>` a `pedro.ortega@españalatente.org`.
- Usar el email introducido en el formulario como `Reply-To`.
- Evitar duplicados en reintentos mediante un UUID de solicitud y una clave de idempotencia de Resend.
- Aplicar un honeypot y un límite básico por email para reducir abuso del formulario público.
- Mostrar éxito únicamente cuando Supabase haya conservado el mensaje y Resend lo haya aceptado.

## Fuera de alcance

- Enviar directamente al correo privado del profesional.
- Recibir o almacenar las respuestas de email dentro de la aplicación.
- Crear una bandeja administrativa o campañas de marketing.
- Confirmar entrega final mediante webhooks de Resend; la primera versión comprobará aceptación de la API y se verificará manualmente la recepción en el buzón.

## Restricciones

- La cuenta de Resend se abrirá con `pedro.ortega@españalatente.org`.
- El usuario debe completar el acceso a Resend, verificar el dominio y crear la API key.
- `RESEND_API_KEY` será un secreto de Vercel y nunca se incluirá en variables `VITE_*`, código cliente, logs o Git.
- El dominio internacionalizado se verificará en Resend con los registros DNS que este proporcione; el valor técnico puede aparecer en punycode.
- La solución se publicará desde una rama `codex/` mediante Vercel, sin modificar `main` ni el historial publicado.
- Se conservarán todos los cambios locales ajenos al trabajo.

## Enfoques considerados

1. **API key directa en Vercel — elegido.** Menor superficie y encaja con una única aplicación y un único buzón. La clave vive como secreto y el backend usa el SDK oficial de Resend.
2. **Vercel Connect.** Ofrece credenciales bajo demanda, pero está orientado a conexiones delegadas o multiusuario y añade complejidad innecesaria aquí.
3. **Función Edge de Supabase.** Mantendría más lógica cerca de la base de datos, pero repartiría el flujo entre Vercel y Supabase y dificultaría el diagnóstico.

## Flujo propuesto

1. El formulario genera un UUID estable para el intento y envía al servidor el profesional, nombre, email, asunto, mensaje y honeypot.
2. El servidor valida tipos, longitudes, email y UUID con Zod.
3. Si el honeypot contiene texto, responde de forma neutra sin guardar ni enviar.
4. El servidor comprueba que el profesional existe y está verificado, y aplica un límite básico de mensajes recientes para el email normalizado.
5. Inserta el mensaje en `contact_messages` usando el UUID como `id`. Si ya existe el mismo UUID, continúa como reintento sin duplicar la fila.
6. Envía el correo con Resend usando `contact-message/<uuid>` como clave de idempotencia.
7. Devuelve éxito solo si Resend responde sin error. Si Resend falla, conserva la fila como respaldo, mantiene el formulario abierto y permite reintentar con el mismo UUID.

## Contenido del correo

- Asunto: `[Directorio] Contacto para <profesional>: <asunto o “Sin asunto”>`.
- Destinatario: `pedro.ortega@españalatente.org`.
- Remitente: `Directorio audiovisual <contacto@españalatente.org>`.
- `Reply-To`: email del remitente.
- Cuerpo HTML y texto plano con nombre, email, profesional, asunto, mensaje y fecha.
- Todo contenido introducido por el usuario se escapará antes de incorporarlo al HTML.

## Configuración

- `RESEND_API_KEY`: secreto de Vercel para producción; nunca legible desde el cliente.
- `CONTACT_EMAIL_TO`: configuración con `pedro.ortega@españalatente.org`.
- `CONTACT_EMAIL_FROM`: configuración con `Directorio audiovisual <contacto@españalatente.org>`.
- Preview usará una clave separada o el remitente de prueba de Resend mientras el dominio no esté verificado.
- Cada alta o cambio de variables exigirá un nuevo despliegue de Vercel.

## Errores y observabilidad

- Los errores de validación devolverán un mensaje accionable sin datos internos.
- Los errores de Supabase o Resend no incluirán credenciales ni el contenido completo del mensaje en logs.
- Se registrarán únicamente el UUID de contacto, la fase fallida y, cuando exista, el identificador de Resend.
- El mensaje de éxito no prometerá entrega final; indicará que la solicitud fue enviada a administración.

## Pruebas y aceptación

- Pruebas unitarias primero para validación, honeypot, duplicados, error de Resend y composición segura del correo.
- Suite completa y compilación de producción sin fallos.
- Preview de Vercel con variables separadas.
- Prueba real desde la ficha de Iñigo: fila creada una sola vez, API de Resend aceptada, correo visible en el panel de Resend y recibido en `pedro.ortega@españalatente.org` con `Reply-To` correcto.
- Solo después de esa verificación se desplegará el mismo cambio a producción.

