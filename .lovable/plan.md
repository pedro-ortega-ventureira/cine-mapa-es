# Corrección integral del destino de recuperación

## Diagnóstico confirmado
- Verificar el backend usado por producción y conservar la evidencia del correo real sin registrar tokens.
- Documentar la cadena de redirecciones y el punto exacto donde aparece cualquier destino incorrecto.
- Tratar los enlaces antiguos como no válidos para comprobar la corrección.

## Cambios
- Definir un único destino compartido: `https://cine-mapa-es.lovable.app/auth?recovery=true`.
- Usarlo desde `/auth` y `/registro`, eliminando la dependencia de `window.location.origin` para recuperación.
- Mantener el formulario de nueva contraseña exclusivamente en `/auth`.
- Añadir pruebas que rechacen `localhost`, cualquier origen distinto y divergencias entre ambas entradas.

## Verificación
- Ejecutar pruebas y compilación.
- Generar un segundo correo nuevo desde el backend de producción.
- Rastrear el enlace sin mostrar tokens y confirmar el formulario, cambio de clave, cierre de sesión temporal, rechazo de la clave anterior y aceptación de la nueva.
- Eliminar todas las cuentas temporales y publicar la versión final.

## Configuración de correo
- Inspeccionar los ajustes accesibles de URL, lista permitida, remitente, seguimiento y plantilla real.
- Si la plantilla administrada no puede leerse o editarse con las herramientas disponibles, indicarlo expresamente sin afirmar una corrección de plantilla no demostrada.
