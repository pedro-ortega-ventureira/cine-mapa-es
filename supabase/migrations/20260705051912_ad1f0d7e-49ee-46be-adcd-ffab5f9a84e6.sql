
REVOKE EXECUTE ON FUNCTION public.set_professional_geo_batch(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_professional_geo_batch(jsonb) TO service_role;
