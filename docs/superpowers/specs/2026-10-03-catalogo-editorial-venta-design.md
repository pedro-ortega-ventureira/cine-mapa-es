# Catálogo editorial orientado a venta

## Objetivo

Crear una página de catálogo comercial para Aulós que ayude a lectores del
ámbito académico, institucional y cultural a descubrir y comprar ediciones.
La prioridad es la compra directa, con una presentación editorial sobria y
especializada; no una página institucional ni un inventario plano.

La primera publicación se realizará únicamente en `staging8.aulos.es`. La
publicación posterior en `aulos.es/catalogo` requerirá una autorización
explícita independiente.

## Estructura

1. **Hero breve.** Protagoniza el producto publicado `6197`, *La vanguardia
   prerrafaelista*. Incluirá portada, título, autoría recuperada de
   WooCommerce, una sinopsis breve y los CTA **Ver edición** y **Añadir al
   carrito**. El segundo usará el flujo estándar de WooCommerce, sin alterar
   precio, stock ni modalidad de compra.
2. **Colecciones.** Se mostrarán en este orden: Aulós Humanidades, Aulós
   Digital, Aulós Academics, Packs, Herejía y Belleza, Mistérica y Catálogos.
   Cada bloque tendrá una frase de alcance, entre tres y cuatro productos
   comprables, y el enlace **Ver colección**.
3. **Todas las ediciones.** La sección final repetirá el mismo orden de
   colecciones. Ofrecerá una navegación de filtro discreta y dirigirá cada
   ficha a su página de producto. No sustituye la navegación nativa de
   WooCommerce.

## Diseño y contenido

- Aplicar el sistema de la home: `#F5F2EC` como fondo, `#171717` para texto,
  burdeos como acento, serif editorial para títulos y sans serif para
  navegación, metadatos y compra.
- Cada tarjeta mostrará portada, colección, título, autoría cuando esté
  disponible, formato/precio y acceso a la ficha. El precio conserva prioridad
  visual suficiente para comprar, sin tratamiento promocional agresivo.
- Packs se presentan como selecciones curatoriales, no como descuentos.
- Un único `h1`; cada colección usa un `h2`; la estructura no introduce texto
  blanco sobre fondos claros.
- La página será a una columna a menos de 768 px; controles y acciones tendrán
  un área táctil mínima de 44 px, foco visible y respeto de
  `prefers-reduced-motion`.

## Arquitectura de implementación

La página se construirá en Elementor con HTML/CSS editorial propio y bloques
de producto que toman datos de WooCommerce. La estructura será curada y
estable, mientras que productos, precios, imágenes y enlaces se recuperarán
de WooCommerce para no duplicar información comercial.

Antes de guardar, se recuperará el documento de Elementor vigente. La
actualización se limitará a la nueva página de catálogo y no modificará la
home, fichas de producto, categorías, precios, inventario ni checkout.

## Manejo de datos incompletos

- Si una colección todavía no existe o no contiene productos publicados, su
  bloque no se muestra y se registra la omisión para revisión; no se crean
  productos ni categorías ficticias.
- Si falta autoría, se omite ese metadato de la tarjeta sin introducir texto
  de relleno.
- Si el producto `6197` no resulta comprable al recuperar su estado actual, el
  hero conservará **Ver edición** y ocultará **Añadir al carrito**, dejando el
  motivo documentado.

## Verificación

1. Validar las funciones de construcción de markup y selección de colecciones
   con pruebas locales antes de la actualización remota.
2. Recuperar configuración de Elementor inmediatamente antes de guardar.
3. Tras publicar, comprobar en staging el HTML y CSS entregados para catálogo,
   hero, tarjetas, botones y vistas móvil.
4. Verificar que el enlace de producto y la acción de añadir al carrito usan
   el producto real y que el contenido de colecciones no expone borradores.
