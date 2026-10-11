# Aulós Production Readiness

Plugin reversible para preparar Aulós antes de producción.

- Redirige exclusivamente `/shop` y `/shop/` a `/catalogo/` con HTTP 301,
  conservando la query string.
- Añade `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` y CSP.
- La versión 1.0.1 aplica la CSP después de inventariar los recursos requeridos
  en staging. El filtro `aulos_csp_mode` permite volver a `report-only`.

Para revertir todos sus efectos, desactivar el plugin. No almacena datos ni
modifica contenido de WordPress o WooCommerce.
