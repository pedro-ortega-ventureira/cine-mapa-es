# Aulós Production Readiness

Plugin reversible para preparar Aulós antes de producción.

- Redirige exclusivamente `/shop` y `/shop/` a `/catalogo/` con HTTP 301,
  conservando la query string.
- Añade `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` y CSP.
- La versión 1.1.0 usa una lista explícita de orígenes para la CSP. El modo se
  guarda en la opción `aulos_csp_mode`: `report-only` es el valor seguro por
  defecto y `enforce` requiere una promoción deliberada.
- Define títulos y metadescripciones editoriales mediante los filtros oficiales
  de AIOSEO y marca carrito y cuenta como `noindex,follow`.
- Corrige exclusivamente en la portada los márgenes negativos heredados de
  `.row`, que producían 15 px de desplazamiento horizontal.

Para revertir sus efectos de salida, desactivar el plugin. No modifica contenido
de WordPress o WooCommerce; solo conserva el modo CSP en una opción de WordPress.
