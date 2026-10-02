-- Un perfil no puede asociar un municipio a un código postal que no le pertenece.
-- Además se corrige el registro histórico de María Salgado, cuyo CP 22820
-- estaba guardado con Yeste (02480) como municipio.

CREATE OR REPLACE FUNCTION public.check_municipio_menor_20k()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  pob integer;
  municipality_postal_codes text[];
  postal_code text;
BEGIN
  IF tg_op = 'INSERT' AND new.municipality_code IS NULL THEN
    RAISE EXCEPTION 'Falta municipality_code: solo se admiten altas en municipios de menos de 20.000 habitantes';
  END IF;

  IF new.municipality_code IS NOT NULL THEN
    SELECT population, postal_codes
      INTO pob, municipality_postal_codes
      FROM public.municipalities
      WHERE code = new.municipality_code;
    IF pob IS NULL THEN
      RAISE EXCEPTION 'Municipio % no existe en municipalities', new.municipality_code;
    END IF;
    IF pob >= 20000 THEN
      RAISE EXCEPTION 'Municipio % tiene % habitantes: supera el límite de 20.000', new.municipality_code, pob;
    END IF;

    -- Solo se comprueba si hay CP: así no se bloquean las fichas históricas
    -- que no tienen uno, pero ninguna ficha con CP puede quedar desalineada.
    postal_code := btrim(coalesce(new.raw_postal_code, ''));
    IF postal_code <> '' AND (
      postal_code !~ '^\d{5}$'
      OR NOT (postal_code = ANY(coalesce(municipality_postal_codes, ARRAY[]::text[])))
    ) THEN
      RAISE EXCEPTION 'El código postal % no corresponde al municipio %', postal_code, new.municipality_code;
    END IF;
  END IF;
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS trg_municipio_menor_20k ON public.professionals;
CREATE TRIGGER trg_municipio_menor_20k
  BEFORE INSERT OR UPDATE OF municipality_code, raw_postal_code ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.check_municipio_menor_20k();

UPDATE public.professionals AS p
SET municipality_code = m.code,
    geo_lat = m.lat,
    geo_lng = m.lng,
    geo_accuracy = CASE WHEN m.lat IS NOT NULL AND m.lng IS NOT NULL THEN 'exact' ELSE 'none' END,
    geo_municipality_name = m.name,
    geo_province = m.province
FROM public.municipalities AS m
WHERE p.id = 'f50e91ab-f51f-4442-a320-7da47d5f809b'
  AND p.raw_postal_code = '22820'
  AND m.code = 'huesca-penas-de-riglos-las';
