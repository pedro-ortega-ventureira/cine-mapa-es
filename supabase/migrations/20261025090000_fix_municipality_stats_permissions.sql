-- The public municipality_stats view runs as SECURITY INVOKER. Its join
-- predicate filters inactive professionals, so the API role must be allowed
-- to read the active flag for PostgreSQL to evaluate the view.
GRANT SELECT (active) ON public.professionals TO anon, authenticated;
