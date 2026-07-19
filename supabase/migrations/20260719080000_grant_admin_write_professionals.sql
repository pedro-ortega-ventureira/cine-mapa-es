-- El rol `authenticated` nunca tuvo permiso de escritura sobre
-- `professionals` ni `filmography_items` (solo SELECT desde la migración
-- inicial). Esto rompe todo el panel de admin: crear/editar/borrar un
-- profesional, verificarlo, o gestionar su filmografía fallan con
-- "permission denied" aunque el usuario sea admin, porque las políticas RLS
-- (que ya exigen has_role admin) solo controlan qué FILAS se ven, no si el
-- rol tiene permitida la operación a nivel de tabla.
--
-- Este GRANT es seguro: sigue siendo la política RLS "Admins full access ..."
-- la que exige has_role(auth.uid(), 'admin') para poder insertar/editar/
-- borrar filas. Un usuario autenticado sin rol admin sigue sin poder
-- escribir nada.
GRANT INSERT, UPDATE, DELETE ON public.professionals TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.filmography_items TO authenticated;
