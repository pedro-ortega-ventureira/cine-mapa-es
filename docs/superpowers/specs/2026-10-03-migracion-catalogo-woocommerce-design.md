# Migración del catálogo de WooCommerce en staging

## Objetivo

Reorganizar los 69 productos de `staging8.aulos.es` de acuerdo con el CSV aprobado por el usuario, aplicando estados y colecciones editoriales y modelando, cuando corresponda, las modalidades `Impreso`, `Digital`, `Amazon` y `Jot Down` como variaciones de WooCommerce.

Los formatos `Impreso` y `Digital` pertenecen a la tienda. `Amazon` y `Jot Down` son salidas externas. El producto enlazado al repositorio de la UAM se representará como una variación externa `Digital` cuyo botón diga `GRATIS`.

## Fuente de verdad

La fuente editorial es `plantilla-edicion-productos-aulos-v4-clasificada.csv`, derivada del CSV entregado por el usuario. Se aplicarán:

- `estado_actual` como estado objetivo (`Publicado` o `Borrador`);
- `coleccion_actual` como única categoría editorial objetivo;
- los enlaces clasificados en `amazon_url`, `jot_down_url` y `gratis_url`;
- los textos de botón `AMAZON`, `JOT DOWN` y `GRATIS`;
- los nombres sin espacios accidentales al principio o al final.

Excepción aprobada: el producto 2207, `París 1900 (digital)`, se asignará a `Aulós Humanidades`, aunque el CSV recibido lo incluía en `Herejía y Belleza`.

Los campos vacíos de las columnas `*_nuevo` no borrarán datos actuales.

## Modelo de producto

### Productos sin salida externa

Los productos que no tengan URL externa conservarán su tipo técnico actual. Solo se actualizarán el estado y la colección indicados en el CSV.

### Productos simples con venta propia y salida externa

Un producto simple que actualmente se venda en Aulós y tenga además un enlace de Amazon o Jot Down se convertirá en producto variable.

Su modalidad interna se inferirá de la configuración actual:

- producto descargable, virtual o identificado inequívocamente como digital: variación `Digital`;
- producto físico: variación `Impreso`.

La variación interna recibirá el precio, SKU, gestión de stock, cantidad de stock, estado de inventario, configuración virtual, configuración descargable, archivos descargables y límites de descarga del producto simple original.

### Productos ya variables

Se conservarán las variaciones internas actuales y sus IDs cuando sea posible. Se añadirán únicamente las modalidades externas que falten. Una variación externa antigua que represente una salida a Jot Down o Amazon se normalizará a la opción correspondiente, evitando duplicados.

### Productos exclusivamente externos

Un producto que actualmente sea de tipo externo y no tenga venta propia se convertirá en variable con una única modalidad externa `Amazon` o `Jot Down`, según el dominio de la URL.

La excepción UAM tendrá una variación `Digital` externa con la URL del repositorio y el texto de botón `GRATIS`.

## Atributos y metadatos

Los productos variables usarán el atributo visible `Formato`. Sus opciones permitidas serán, según cada producto:

- `Impreso`
- `Digital`
- `Amazon`
- `Jot Down`

Las salidas externas se almacenarán usando el contrato del plugin WPC External Variations 1.1.0:

- `wpcev_url`: URL externa completa;
- `wpcev_text`: `AMAZON`, `JOT DOWN` o `GRATIS`.

No se crearán opciones sin evidencia en el producto actual o en el CSV.

## Estados y categorías

Se aplicarán los 28 cambios de estado detectados en el CSV. Publicar un producto será una acción explícita de la migración, no un efecto secundario de convertirlo en variable.

Cada producto quedará asignado a la colección editorial indicada por el usuario. Se crearán las categorías que no existan y se resolverán sus IDs antes de actualizar productos. La asignación reemplazará las categorías editoriales anteriores del producto.

## Seguridad y reversión

Antes de escribir se guardará un respaldo JSON fechado que incluya:

- los 69 productos con todos los campos devueltos por WooCommerce;
- todas las variaciones y sus metadatos;
- las categorías de producto;
- el CSV clasificado utilizado como entrada;
- un manifiesto con fecha, dominio y recuentos.

La migración se ejecutará por producto, registrando cada respuesta sin credenciales. Si una escritura falla, se detendrá antes del siguiente producto. El respaldo será la fuente de restauración de los productos ya procesados.

No se modificará producción ni `aulos.es`.

## Validación

Antes de escribir:

- los 69 IDs del CSV deben existir una sola vez en staging;
- toda URL debe pertenecer a Amazon, Jot Down o repositorio UAM;
- los 36 enlaces deben clasificarse sin ambigüedad;
- los productos convertidos deben tener una modalidad interna inequívoca o ser exclusivamente externos.

Después de escribir:

- volver a extraer los 69 productos y todas sus variaciones;
- comprobar estados y categorías contra el CSV, incluida la excepción 2207;
- comprobar que hay 25 variaciones Amazon, 10 Jot Down y una salida UAM con botón `GRATIS`;
- comprobar que cada URL coincide exactamente con la entregada;
- comprobar que precio, SKU, stock y descargas de la venta propia se conservaron;
- abrir una ficha representativa de Impreso, Digital, Amazon, Jot Down y UAM;
- confirmar que las fichas publicadas renderizan y que los botones externos llevan al destino esperado.

## Fuera de alcance

- Modificar el sitio de producción.
- Borrar definitivamente productos o variaciones.
- Inventar precios, SKU, existencias, archivos o enlaces ausentes.
- Cambiar descripciones, imágenes, SEO o maquetación de producto.
- Desactivar o eliminar WPC External Variations.
