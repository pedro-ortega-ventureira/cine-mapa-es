-- rls_auto_enable es un event trigger interno: no debe estar expuesto en la API REST.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- La vista de estadísticas debe respetar RLS del usuario que consulta (no la del creador).
alter view public.municipality_stats set (security_invoker = true);
