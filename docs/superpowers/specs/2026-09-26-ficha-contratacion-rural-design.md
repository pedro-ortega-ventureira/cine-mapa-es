# Diseño: ficha orientada a contratación audiovisual rural

Fecha: 26 de septiembre de 2026

## Objetivo

Facilitar la contratación de profesionales audiovisuales residentes en el medio rural. La ficha debe demostrar experiencia profesional y hacer visibles las condiciones operativas que determinan si una persona puede incorporarse a un rodaje rural.

Las producciones mostradas no tienen que estar relacionadas con la España rural. Son prueba de experiencia general.

## Alcance

La entrega ampliará:

- el formulario de alta y edición de la ficha profesional;
- la ficha pública del profesional;
- los filtros del directorio;
- el modelo de datos de profesionales y filmografía;
- las operaciones autenticadas para que cada profesional gestione sus propias producciones.

No incluye mensajería directa, subida de imágenes, importación automática desde redes sociales ni búsqueda externa de producciones.

## Datos del profesional

Se añadirán a `professionals`:

- `travel_scope`: `local`, `provincial`, `national` o `international`;
- `has_own_vehicle`: booleano;
- `has_cargo_vehicle`: booleano;
- `can_drive_van`: booleano.

La disponibilidad seguirá usando los estados existentes: `Disponible`, `No disponible` y `Bajo consulta`. También se conservarán `works_remotely` y `willing_to_travel`; este último indicará voluntad general de viajar, mientras que `travel_scope` expresará el alcance máximo.

Los campos de transporte y movilidad serán opcionales para no invalidar fichas existentes. Se mostrarán públicamente y podrán utilizarse como filtros.

## Portfolio y redes

El campo `website` existente se presentará como **Web o portfolio**.

El objeto `social_links` existente admitirá enlaces opcionales para:

- Instagram;
- TikTok;
- LinkedIn;
- Facebook;
- X;
- Vimeo;
- YouTube.

Cada valor se validará como URL HTTP o HTTPS. Solo se guardarán claves con valores no vacíos. Las redes se mostrarán como enlaces en la ficha pública y no se usarán como filtros.

## Producciones destacadas

Cada profesional podrá mantener hasta cinco producciones destacadas en `filmography_items`. Se reutilizará la tabla existente y se añadirán:

- `countries`: lista de países, opcional;
- `genre`: texto, opcional;
- `external_url`: URL HTTP o HTTPS, opcional.

También se reutilizarán:

- `title`: obligatorio;
- `year`: obligatorio para las nuevas entradas autogestionadas;
- `role_in_production`: obligatorio para las nuevas entradas autogestionadas;
- `poster_url`: URL opcional de la portada o cartel;
- `type`: película, televisión, cortometraje u otro;
- `sort_order`: orden elegido por el profesional;
- `featured`: verdadero para las entradas autogestionadas visibles.

No se impondrá inmediatamente `NOT NULL` sobre `year` o `role_in_production` en la base de datos porque puede haber registros históricos incompletos. La obligatoriedad se aplicará en el nuevo contrato de escritura y en la interfaz. Una restricción o trigger de base de datos impedirá superar cinco entradas por profesional, incluso ante solicitudes simultáneas.

## Operaciones y seguridad

Se añadirán operaciones de servidor en el flujo de registro público para:

1. listar la filmografía del profesional autenticado;
2. crear o actualizar una producción propia;
3. eliminar una producción propia;
4. reordenar las producciones propias.

Todas las operaciones resolverán primero el profesional mediante el `user_id` de la sesión verificada. Ningún identificador enviado por el navegador bastará para autorizar una modificación. Las actualizaciones y eliminaciones comprobarán además que `filmography_items.professional_id` coincide con el perfil autenticado.

Las operaciones administrativas existentes seguirán funcionando. La lectura pública continuará limitada a la filmografía de perfiles verificados.

## Interfaz de edición

La ficha se organizará en estos bloques:

1. datos personales;
2. ubicación y contacto;
3. actividad profesional;
4. movilidad y logística;
5. portfolio y redes;
6. sobre ti;
7. producciones destacadas.

Movilidad y logística contendrá disponibilidad, remoto, disposición a viajar, radio de desplazamiento y los tres datos de transporte.

Producciones destacadas mostrará una lista de un máximo de cinco tarjetas editables. Cada tarjeta permitirá introducir título, año, tipo, rol, países, género, URL externa y URL de portada. Se podrá eliminar y cambiar el orden. Para un perfil nuevo, este bloque se habilitará después de guardar por primera vez, porque las producciones necesitan un `professional_id`.

Los errores de validación se mostrarán junto al bloque afectado y no descartarán los demás datos introducidos.

## Ficha pública

La ficha pública mostrará:

- disponibilidad y condiciones de movilidad;
- capacidades de transporte;
- web/portfolio y redes;
- hasta cinco producciones ordenadas, con cartel cuando exista, título, año, países, género, rol y enlace externo.

Los campos opcionales vacíos no generarán etiquetas ni espacios de relleno.

## Filtros del directorio

La URL de `/directorio` incorporará parámetros validados para:

- disponibilidad;
- trabajo en remoto;
- disposición a viajar;
- radio de desplazamiento;
- vehículo propio;
- vehículo de carga;
- permiso para conducir furgoneta.

Los booleanos tendrán tres estados: todos, sí y no. El filtrado se realizará en la consulta a Supabase junto con los filtros existentes. Todos los parámetros se conservarán al combinar filtros y se eliminarán con “Limpiar filtros”.

El mapa y el listado consumirán el mismo resultado filtrado.

## Migración y compatibilidad

Una migración aditiva creará las columnas nuevas, los valores permitidos de `travel_scope` y el límite de cinco producciones. Los valores por defecto serán nulos para distinguir “no indicado” de “no”.

Las fichas actuales seguirán siendo válidas. La migración no reescribirá producciones ni perfiles existentes. Los tipos TypeScript de Supabase se actualizarán en el mismo cambio.

## Pruebas

Se desarrollará con pruebas primero para cubrir:

- validación y normalización de movilidad, redes y producciones;
- obligatoriedad de título, año y rol;
- límite de cinco producciones;
- autorización por propiedad del perfil;
- traducción de parámetros de URL a filtros de directorio;
- combinación de filtros nuevos y existentes;
- conversión entre filas de base de datos y estado del formulario.

La verificación final incluirá suite completa, lint, compilación y una comprobación manual del flujo de alta, edición, ficha pública y filtrado.

## Criterios de aceptación

- Un profesional puede completar movilidad, transporte, web/portfolio y redes.
- Un profesional puede mantener hasta cinco producciones, cada una con título, año y rol obligatorios y cartel mediante URL.
- No puede modificar producciones de otra persona ni superar el límite.
- La ficha pública presenta los datos nuevos sin mostrar campos vacíos.
- El directorio permite combinar todos los filtros operativos acordados.
- Las fichas y producciones existentes siguen funcionando sin intervención manual.
