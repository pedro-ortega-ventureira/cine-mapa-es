
DROP VIEW IF EXISTS public.municipality_stats;
CREATE VIEW public.municipality_stats
WITH (security_invoker = true) AS
SELECT m.code,
       m.name,
       m.province,
       m.autonomous_community,
       m.population,
       m.lat,
       m.lng,
       COUNT(p.id)::integer AS professionals_count,
       COUNT(p.id) FILTER (WHERE p.verified)::integer AS verified_count
FROM public.municipalities m
LEFT JOIN public.professionals p ON p.municipality_code = m.code
GROUP BY m.code, m.name, m.province, m.autonomous_community, m.population, m.lat, m.lng;

GRANT SELECT ON public.municipality_stats TO anon, authenticated;
