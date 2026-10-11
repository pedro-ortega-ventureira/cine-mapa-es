# Preparación de Aulós para producción

## Alcance aprobado

Preparar `staging8.aulos.es` para una decisión final de despliegue mediante cuatro actuaciones: corregir la jerarquía de encabezados, hacer de `/catalogo/` la única entrada pública al catálogo, auditar el SEO técnico de las páginas principales y aplicar cabeceras HTTP de seguridad. La prueba completa de compra queda expresamente fuera de alcance.

## Diseño

La primera fase será una auditoría autenticada y reproducible de home, catálogo, zine, publicación, una ficha de producto y las páginas transaccionales y legales. Registrará código HTTP, título, metadescripción, canonical y jerarquía `H1–H3`, distinguiendo el contenido principal de encabezados duplicados introducidos por el tema.

La corrección semántica se aplicará en el origen responsable: Elementor para contenido editorial y el componente global del tema si la duplicidad procede de la cabecera. Cada página indexable tendrá un único `H1` visible y descriptivo, sin cambiar su aspecto.

`/shop/` responderá con una redirección permanente a `/catalogo/`, conservando la query string. `/catalogo/` mantendrá canonical propio. Se comprobará que productos, carrito y cuenta no son redirigidos.

Las cabeceras se encapsularán en un plugin pequeño y reversible. Incluirá `Referrer-Policy`, `Permissions-Policy`, protección contra framing y una CSP compatible con WordPress, Elementor, WooCommerce y los recursos externos observados. La CSP se validará primero en modo `Report-Only`; solo pasará a modo aplicado si no bloquea recursos necesarios.

## Seguridad y publicación

- Solo se modificará `staging8.aulos.es`; producción requerirá una autorización posterior.
- Antes de guardar Elementor o widgets se recuperará su versión vigente y se cancelará ante cualquier cambio concurrente.
- No se registrarán cookies, nonces ni credenciales.
- El plugin será desactivable para revertir redirección y cabeceras sin tocar contenido.
- El informe SEO separará errores bloqueantes de recomendaciones; no se reescribirá copy SEO sin aprobación adicional.

## Criterios de aceptación

- Una sola etiqueta `H1` de contenido por página indexable auditada.
- `/shop/` redirige con 301 a `/catalogo/`; `/catalogo/` responde 200 y se declara canonical.
- Ninguna ruta de producto, carrito o cuenta queda incluida en la redirección.
- Existe un informe con títulos, descripciones, canonicals, encabezados y recomendaciones por URL.
- Las cuatro familias de cabeceras aprobadas aparecen en respuestas de staging y la CSP no rompe los recursos requeridos.
- No se ejecuta ninguna compra de prueba ni se cambia producción.
