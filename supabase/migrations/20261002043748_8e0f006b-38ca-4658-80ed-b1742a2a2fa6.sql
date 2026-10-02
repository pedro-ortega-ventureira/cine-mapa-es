ALTER TABLE public.professionals
  ADD COLUMN travel_scope TEXT,
  ADD COLUMN has_own_vehicle BOOLEAN,
  ADD COLUMN has_cargo_vehicle BOOLEAN,
  ADD COLUMN can_drive_van BOOLEAN,
  ADD CONSTRAINT professionals_travel_scope_check
    CHECK (travel_scope IS NULL OR travel_scope IN ('local', 'provincial', 'national', 'international'));

GRANT SELECT (travel_scope, has_own_vehicle, has_cargo_vehicle, can_drive_van)
ON public.professionals TO anon, authenticated;

ALTER TABLE public.filmography_items
  ADD COLUMN countries TEXT[],
  ADD COLUMN genre TEXT,
  ADD COLUMN external_url TEXT;

CREATE OR REPLACE FUNCTION public.enforce_five_featured_productions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.professional_id::text, 0));

  IF NEW.featured IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF (
    SELECT count(*)
    FROM public.filmography_items
    WHERE professional_id = NEW.professional_id
      AND featured = true
      AND id <> NEW.id
  ) >= 5 THEN
    RAISE EXCEPTION 'Máximo de 5 producciones destacadas'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_five_featured_productions ON public.filmography_items;
CREATE TRIGGER enforce_five_featured_productions
  BEFORE INSERT OR UPDATE OF featured, professional_id ON public.filmography_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_five_featured_productions();

CREATE OR REPLACE FUNCTION public.reorder_featured_filmography(
  _professional_id UUID,
  _item_ids UUID[]
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(_professional_id::text, 0));

  IF cardinality(_item_ids) > 5
    OR cardinality(_item_ids) <> (
      SELECT count(DISTINCT requested.id)
      FROM unnest(_item_ids) AS requested(id)
    )
    OR cardinality(_item_ids) <> (
      SELECT count(*)
      FROM public.filmography_items
      WHERE professional_id = _professional_id AND featured = true
    )
    OR EXISTS (
      SELECT 1
      FROM unnest(_item_ids) AS requested(id)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.filmography_items AS item
        WHERE item.id = requested.id
          AND item.professional_id = _professional_id
          AND item.featured = true
      )
    ) THEN
    RAISE EXCEPTION 'La lista de producciones destacadas no coincide con el perfil'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.filmography_items AS item
  SET sort_order = requested.position - 1
  FROM unnest(_item_ids) WITH ORDINALITY AS requested(id, position)
  WHERE item.id = requested.id
    AND item.professional_id = _professional_id
    AND item.featured = true;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_featured_filmography(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_featured_filmography(UUID, UUID[]) TO service_role;