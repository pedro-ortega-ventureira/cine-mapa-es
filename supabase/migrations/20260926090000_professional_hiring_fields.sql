ALTER TABLE public.professionals
  ADD COLUMN travel_scope TEXT,
  ADD COLUMN has_own_vehicle BOOLEAN,
  ADD COLUMN has_cargo_vehicle BOOLEAN,
  ADD COLUMN can_drive_van BOOLEAN,
  ADD CONSTRAINT professionals_travel_scope_check
    CHECK (travel_scope IS NULL OR travel_scope IN ('local', 'provincial', 'national', 'international'));

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

  IF (
    SELECT count(*)
    FROM public.filmography_items
    WHERE professional_id = NEW.professional_id
  ) >= 5 THEN
    RAISE EXCEPTION 'Máximo de 5 producciones destacadas'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_five_featured_productions ON public.filmography_items;
CREATE TRIGGER enforce_five_featured_productions
  BEFORE INSERT ON public.filmography_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_five_featured_productions();
