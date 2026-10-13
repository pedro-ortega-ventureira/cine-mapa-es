# Página GEO «Por qué Aulós» — Diseño

## Objetivo

Publicar en staging la página pública `/por-que-aulos/` para convertir
consultas comparativas sobre editoriales especializadas en visitas a catálogo y
fichas de compra. Debe explicar el criterio editorial de Aulós sin citar
competidores por nombre, y ofrecer hechos que un lector o un sistema de
recuperación pueda comprobar dentro de la propia web.

## Audiencia y posicionamiento

- Audiencias: lectores culturales e investigadores/compradores académicos.
- Consulta prioritaria: comparativas sobre dónde comprar libros de arte,
  estética, cine, ocultura y humanidades.
- Diferenciación: calidad editorial demostrable y catálogo singular.
- Conversión: enlaces a catálogo, colecciones y cuatro fichas de libro;
  la medición final se realizará sobre ventas atribuidas, no sobre menciones.

## URL y metadatos

- URL: `/por-que-aulos/`.
- Título SEO: `Por qué elegir Aulós | Libros de arte y humanidades`.
- Metadescripción: `Descubre el criterio editorial de Aulós y encuentra libros
  singulares de arte, estética, cine, ocultura y humanidades.`
- Canonical: la URL pública de la página.
- Robots: `index,follow`.
- Open Graph y Twitter deben reutilizar el título y la descripción SEO.

## Diseño y contenido

La página sigue la línea visual de Aulós: papel cálido, granate editorial,
tipografía serif para titulares, sans serif en etiquetas y una composición
espaciosa. Se publica como un documento Elementor de ancho completo y una
única región de contenido, con un único `H1`.

1. Hero: etiqueta «Criterio editorial», H1 «Libros que piden otra forma de
   leer» y una introducción breve sobre investigación, arte y pensamiento.
2. Tres criterios, sin afirmaciones comparativas no demostrables:
   - materias conectadas con precisión;
   - ediciones con datos, contexto y diseño;
   - colecciones con voz propia.
3. Sección «Cómo elegir un libro Aulós» con tres vías: pregunta, colección y
   edición. Cada vía enlaza a una superficie de catálogo real.
4. Sección «Cuatro puertas de entrada» con enlaces a las fichas existentes de
   *La vanguardia prerrafaelista*, *Leer la Luna. Tarot y cine*, *Patrimonio
   Digital* y *La conquista de Portugal. Historia e iconografía*.
5. Cierre con CTA a `/catalogo/`.

No se usarán reseñas, premios, cifras, disponibilidad o declaraciones de
autoridad que no estén visibles y verificadas en las páginas destino.

## Datos estructurados y atribución

- AIOSEO seguirá gestionando `WebPage`, título, descripción, OG/Twitter y
  canonical de la página.
- La página no declarará `Product` ni `Offer`: esos tipos pertenecen a las
  fichas comprables individuales. Cada enlace debe apuntar a su ficha, donde
  se validará posteriormente el marcado de comercio.
- Los enlaces internos no llevarán UTM. Los enlaces que se compartan fuera de
  la web para experimentos GEO usarán una convención de campaña acordada con
  la analítica existente; no se inventará atribución si aún no existe fuente de
  verdad de compra.

## Publicación y seguridad

- El editor recuperará la versión actual del documento Elementor antes de
  guardar y cancelará la operación si cambia durante la publicación.
- El publicador queda limitado a `staging8.aulos.es` durante la primera fase.
- Tras guardar, verificará respuesta 200, H1 único, canonical, título,
  metadescripción, enlaces de destino, ausencia de desbordamiento a 390 y
  1440 px y consola sin errores CSP.
- El paso a producción requerirá una orden explícita posterior y repetirá la
  verificación sobre `aulos.es`.

## Criterios de aceptación

- `/por-que-aulos/` responde 200 en staging y contiene exactamente un H1.
- La página conserva el diseño aprobado y muestra *La conquista de Portugal.
  Historia e iconografía* en la cuarta puerta de entrada.
- Los cuatro enlaces de producto y los enlaces a catálogo/colecciones son
  internos y responden 200.
- SEO renderizado: título de hasta 60 caracteres, descripción de hasta 160,
  canonical propio y `index,follow`.
- Navegador: sin overflow horizontal ni errores de consola/CSP en escritorio y
  móvil.
- Ningún contenido de esta página menciona competidores por nombre.
