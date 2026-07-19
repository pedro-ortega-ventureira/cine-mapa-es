-- Da rol de admin a la cuenta con la que Pedro se loguea. Sin esto, el
-- usuario está autenticado pero has_role(admin) devuelve false y todas las
-- funciones de servidor del panel de admin (listar/editar profesionales,
-- vincular TMDB, etc.) responden "Forbidden: admin only".
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'pedro.ortega@mentenebre.org'
ON CONFLICT (user_id, role) DO NOTHING;
