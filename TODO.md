# Pendientes

## Panel admin: pantalla en blanco para usuarios sin rol admin

Si un usuario autenticado sin rol de administrador (por ejemplo, un
profesional que se registró vía `/registro`) hace clic en el enlace "Admin"
del menú, la app se queda en blanco en lugar de mostrar un mensaje de
"no autorizado".

Causa: `src/routes/_authenticated/route.tsx` solo comprueba que exista
sesión (`beforeLoad`), no que el usuario tenga el rol `admin` (eso se
comprueba más abajo, por página, vía `assertAdmin()` en las server
functions). Cuando una query admin-only falla para un usuario sin permisos,
el error no está capturado por ningún error boundary y React se queda en
blanco (visto como error de hidratación #419 en producción).

Fix sugerido: en el `beforeLoad` de `_authenticated/route.tsx`, además de
comprobar sesión, llamar a `has_role` (o una función equivalente) y, si el
usuario no es admin, hacer `redirect({ to: "/" })` o mostrar una página de
"no tienes permisos" en vez de dejar que el resto del árbol intente
renderizar con datos a los que no tiene acceso.

Detectado: 19/07/2026, durante verificación post-deploy.
