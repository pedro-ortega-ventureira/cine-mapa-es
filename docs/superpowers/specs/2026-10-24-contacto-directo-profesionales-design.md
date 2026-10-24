# Contacto directo con profesionales

## Intención

Cada mensaje enviado desde la ficha de un profesional debe llegar al correo guardado en ese perfil, no a un buzón general. Si el perfil no dispone de una dirección válida, la interfaz debe informar de que ese profesional no puede recibir mensajes.

## Alcance

- El servidor consultará `professionals.email` junto con el nombre y el estado de verificación.
- Solo los perfiles verificados y con un correo válido podrán recibir contactos.
- El destinatario se incorporará al payload persistido antes de reservar el mensaje, conservando la idempotencia y los reintentos actuales.
- `CONTACT_EMAIL_FROM` seguirá definiendo el remitente verificado de Resend y el correo del visitante seguirá siendo `Reply-To`.
- `CONTACT_EMAIL_TO` dejará de ser necesario.
- El correo del profesional no se devolverá al navegador ni se añadirá a consultas públicas.

## Comportamiento de error

Cuando el perfil no tenga correo, esté vacío o sea inválido, el envío se rechazará antes de reservar el contacto o llamar a Resend con el mensaje: «Este profesional no puede recibir mensajes».

## Enfoques considerados

1. **Correo de `professionals.email` consultado en el servidor (elegido):** funciona también con perfiles importados, evita exponer la dirección y encaja con el repositorio actual.
2. **Correo de Supabase Auth:** se descartó porque solo cubre perfiles vinculados a una cuenta de acceso.
3. **Buzón general como respaldo:** se descartó por decisión expresa; un perfil sin correo debe figurar como no disponible para mensajes.

## Verificación

Las pruebas cubrirán el destinatario específico del profesional, espacios en blanco, correo ausente o inválido, ausencia de `CONTACT_EMAIL_TO`, persistencia del payload y ausencia de llamadas a reserva/Resend cuando el destinatario no sea utilizable. Después se ejecutarán todas las pruebas y la compilación de producción.
