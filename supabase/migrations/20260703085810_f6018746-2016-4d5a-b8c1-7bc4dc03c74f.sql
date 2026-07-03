
CREATE OR REPLACE FUNCTION public.seed_municipalities_batch(_payload jsonb)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  n INTEGER;
BEGIN
  INSERT INTO public.municipalities (code, name, province, autonomous_community, population, lat, lng)
  SELECT
    (r->>'code')::text,
    (r->>'name')::text,
    (r->>'province')::text,
    (r->>'autonomous_community')::text,
    COALESCE((r->>'population')::integer, 0),
    NULLIF(r->>'lat', '')::double precision,
    NULLIF(r->>'lng', '')::double precision
  FROM jsonb_array_elements(_payload) AS r
  ON CONFLICT (code) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.seed_municipalities_batch(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_municipalities_batch(jsonb) TO service_role, authenticated;
