
CREATE OR REPLACE FUNCTION public.seed_postal_codes_batch(_payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer := 0;
BEGIN
  WITH upd AS (
    UPDATE public.municipalities m
    SET postal_codes = (
      SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(m.postal_codes, ARRAY[]::text[]) || r.cps))
    )
    FROM (
      SELECT (e->>'code')::text AS code,
             ARRAY(SELECT jsonb_array_elements_text(e->'postal_codes'))::text[] AS cps
      FROM jsonb_array_elements(_payload) AS e
    ) r
    WHERE m.code = r.code
    RETURNING 1
  )
  SELECT COUNT(*) INTO n FROM upd;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.seed_postal_codes_batch(jsonb) FROM PUBLIC;

DROP VIEW IF EXISTS public.municipality_stats;
CREATE VIEW public.municipality_stats AS
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
