# WebMCP de descubrimiento editorial para Aulós — Diseño

## Objetivo

Hacer que un agente compatible con WebMCP pueda descubrir de forma fiable el
contenido público de Aulós y guiar al visitante desde una pregunta cultural a
artículos gratuitos del Zine y, cuando proceda, a ediciones de pago del
catálogo. La conversión buscada es una visita cualificada a una ficha de libro
o al catálogo; la compra, el carrito y el pago permanecen bajo control
explícito de la persona usuaria en WooCommerce.

## Contexto comprobado

La revisión de `staging8.aulos.es` el 14 de octubre de 2026 confirma estas
superficies públicas:

- Inicio: presenta Aulós y enlaza a catálogo, Zine y publicación de originales.
- `/catalogo/`: organiza libros por Aulós Humanidades, Aulós Digital, Aulós
  Academics, Packs, Herejía y Belleza y Mistérica; enlaza fichas de producto.
- `/zine/`: ofrece artículos gratuitos, con categorías como estética, gótico,
  historia del arte, humanidades, humanidades digitales y ocultura.

La prioridad comercial aprobada es venta directa de libros especializados para
lectores culturales e investigadores. El contenido gratuito debe ser una
puerta de descubrimiento, no un contenido bloqueado ni una promesa de compra.

## Alcance del MVP

Un plugin de WordPress, `aulos-webmcp-discovery`, publica tres herramientas de
solo lectura en las páginas públicas de Aulós:

| Herramienta | Entrada | Respuesta | Destino comercial |
| --- | --- | --- | --- |
| `explorar_contenidos` | tema, categoría opcional, máximo de resultados | artículos y categorías del Zine, con título, extracto breve y URL canónica | lectura gratuita |
| `buscar_ediciones` | consulta, colección o formato opcionales, máximo de resultados | productos publicados con título, autor si existe, formato, precio visible, disponibilidad y URL canónica | ficha de libro |
| `recomendar_ruta_de_lectura` | pregunta cultural, interés y máximo de resultados | una ruta con artículos gratuitos pertinentes y hasta dos libros relacionados, explicando el vínculo solo con datos recuperados | Zine → ficha/catálogo |

Los resultados conservan la distinción explícita entre `gratuito` y `edición de
pago`. Ninguna herramienta acepta datos personales, inicia sesión, añade al
carrito, aplica cupones ni crea pedidos.

## Arquitectura

El plugin tiene tres piezas aisladas:

1. **Proveedor de datos PHP.** Consulta únicamente contenido publicado de
   WordPress y WooCommerce. Expone dos rutas REST internas de solo lectura:
   una para artículos/categorías y otra para productos/colecciones. Las rutas
   devuelven un modelo normalizado, paginado y limitado; no exponen usuarios,
   pedidos, metadatos privados ni borradores.
2. **Adaptador de recomendación PHP.** Combina resultados por coincidencia de
   términos entre la consulta, categorías, títulos, extractos y colecciones.
   No llama a un modelo externo ni inventa relaciones. Si no hay evidencia
   suficiente, devuelve resultados separados en vez de afirmar una
   recomendación.
3. **Registro WebMCP en el navegador.** Un único script público, cargado en
   las páginas de Aulós, comprueba soporte de `document.modelContext` y
   registra las tres herramientas imperativas. Cada handler llama a las rutas
   REST del mismo origen y devuelve un objeto estructurado que contiene texto
   breve y enlaces canónicos.

La API de navegador es progresiva: si WebMCP no está disponible, el script no
hace nada y la web pública mantiene el mismo comportamiento. No se instalarán
polyfills ni SDKs de terceros en el MVP.

## Contratos y comportamiento

- `tema`, `consulta`, `pregunta` e `interes` se limpian, se recortan a 160
  caracteres y no se guardan.
- `maximo_resultados` es opcional y queda entre 1 y 6; el valor por defecto es
  3.
- Las respuestas incluyen `tipo` (`articulo` o `producto`), `acceso`
  (`gratuito` o `pago`), título, resumen de hasta 280 caracteres, colección o
  categoría cuando exista y URL canónica HTTPS.
- Los productos muestran precio y disponibilidad solo cuando coincidan con el
  dato público actual de WooCommerce. Si falta uno, se omite el campo, no se
  deduce.
- La ruta de lectura devuelve primero resultados gratuitos. Solo añade hasta
  dos productos cuando comparten términos o una taxonomía recuperable con el
  interés solicitado; el campo `motivo` describe ese vínculo factual.
- Cada resultado de pago ofrece `url_ficha`; se puede incluir una URL de
  catálogo como alternativa. El agente debe presentar el enlace para que la
  navegación y cualquier compra sean decisiones visibles del usuario.

## Seguridad, privacidad y atribución

- Las rutas REST usan métodos `GET`, `permission_callback` público y una lista
  explícita de campos de salida. No hay endpoints mutables.
- Se validan y escapan todos los parámetros y se aplican límites de tamaño,
  paginación y frecuencia por IP para evitar enumeración y abuso.
- El script no recibe secretos, nonces administrativos ni credenciales de
  WooCommerce. Toda consulta se hace contra el mismo origen.
- Las descripciones de herramientas dicen qué información devuelven y qué no
  pueden hacer. No se usan instrucciones de página como autorización para
  ampliar el alcance de una herramienta.
- La analítica registra eventos agregados de invocación, resultado y clic a
  ficha solo si el consentimiento vigente lo permite. Los enlaces no llevan
  identificadores personales; la convención de campaña se coordinará con la
  analítica existente antes de activarla.

## Compatibilidad y despliegue

WebMCP se encuentra en fase de estándar propuesto y Chrome lo ofrece mediante
un *origin trial*. El plugin se instala y prueba únicamente en
`staging8.aulos.es`. El registro se protege con detección de capacidad para que
la ausencia de la API no produzca errores de consola ni afecte a usuarios de
otros navegadores. El despliegue a `aulos.es` queda fuera de alcance y requerirá
autorización expresa.

## Pruebas y criterios de aceptación

- Pruebas unitarias de normalización, límites, coincidencia temática y ausencia
  de datos privados.
- Pruebas de integración de ambas rutas REST: contenido publicado únicamente,
  estructura correcta, límites respetados y URLs canónicas internas.
- Prueba de navegador con WebMCP habilitado: DevTools detecta exactamente las
  tres herramientas y cada una responde a una consulta válida y a una inválida
  sin excepción.
- Prueba de regresión sin WebMCP: inicio, Zine, catálogo, ficha de producto y
  carrito cargan sin cambios funcionales ni errores de consola.
- Revisión manual en staging: cada ruta recomendada muestra al menos un
  recurso gratuito cuando existe, separa correctamente los productos de pago y
  nunca modifica el carrito ni requiere inicio de sesión.
- Verificación de medición: con consentimiento, se registra la invocación y un
  clic a ficha; sin consentimiento, no se emite el evento analítico.

## Fuera de alcance

- Acciones de WooCommerce: carrito, checkout, cupón, cuenta, pedidos o pago.
- Recomendaciones generadas por un LLM externo o personalización por historial.
- Acceso a borradores, datos de clientes, analítica individual o contenidos de
  pago no publicados.
- Publicación en producción y cambios de contenido o diseño de las páginas
  existentes.
