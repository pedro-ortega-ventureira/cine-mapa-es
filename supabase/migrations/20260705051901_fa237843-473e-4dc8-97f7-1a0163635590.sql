
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS geo_lat double precision,
  ADD COLUMN IF NOT EXISTS geo_lng double precision,
  ADD COLUMN IF NOT EXISTS geo_accuracy text CHECK (geo_accuracy IN ('exact','province','none')),
  ADD COLUMN IF NOT EXISTS geo_municipality_name text,
  ADD COLUMN IF NOT EXISTS geo_province text;

CREATE INDEX IF NOT EXISTS idx_professionals_geo ON public.professionals (geo_accuracy) WHERE geo_lat IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_professional_geo_batch(_payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer := 0;
BEGIN
  WITH upd AS (
    UPDATE public.professionals p
    SET geo_lat = NULLIF(r.lat, 'NaN'::double precision),
        geo_lng = NULLIF(r.lng, 'NaN'::double precision),
        geo_accuracy = r.accuracy,
        geo_municipality_name = r.muni,
        geo_province = r.prov,
        updated_at = now()
    FROM (
      SELECT (e->>'id')::uuid AS id,
             NULLIF(e->>'lat','')::double precision AS lat,
             NULLIF(e->>'lng','')::double precision AS lng,
             (e->>'accuracy')::text AS accuracy,
             NULLIF(e->>'muni','')::text AS muni,
             NULLIF(e->>'prov','')::text AS prov
      FROM jsonb_array_elements(_payload) AS e
    ) r
    WHERE p.id = r.id
    RETURNING 1
  )
  SELECT COUNT(*) INTO n FROM upd;
  RETURN n;
END $$;
