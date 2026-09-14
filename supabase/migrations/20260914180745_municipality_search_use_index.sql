-- Estado final de search_municipalities.
--
-- La versión anterior calculaba la clave normalizada en un CTE y la cruzaba
-- con `municipalities`. Funcionalmente correcto, pero el planificador no podía
-- usar el índice trigram con un patrón que sale de un join: 128 ms y escaneo
-- completo (8.290 buffers) en cada pulsación de tecla. Con el patrón como
-- variable de plpgsql pasa a ser un parámetro y el índice entra: ~13 ms y 689
-- buffers.
--
-- Además se separan las dos búsquedas en lugar de unirlas con OR. El OR
-- obligaba a recorrer la tabla entera aunque el nombre sí fuese indexable,
-- porque la rama de códigos postales no tiene índice. Como una consulta o es
-- toda dígitos (código postal) o no lo es (nombre/provincia), la disyuntiva se
-- resuelve antes de consultar.

CREATE OR REPLACE FUNCTION public.search_municipalities(
  _q text,
  _limit integer DEFAULT 30
)
RETURNS TABLE (
  code text,
  name text,
  province text,
  population integer,
  postal_codes text[]
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  k text := public.municipality_normalize(_q);
  n integer := least(greatest(coalesce(_limit, 30), 1), 50);
BEGIN
  -- Menos de dos caracteres útiles no es una búsqueda. Como `k` ya viene
  -- normalizada (sin puntuación), los comodines de LIKE que alguien escriba
  -- — % o _ — han desaparecido aquí y no pueden llegar al patrón.
  IF k IS NULL OR length(k) < 2 THEN
    RETURN;
  END IF;

  IF k ~ '^[0-9]+$' THEN
    -- Código postal: exacto primero, luego por prefijo mientras se teclea.
    RETURN QUERY
    SELECT m.code, m.name, m.province, m.population, m.postal_codes
    FROM public.municipalities m
    WHERE m.population < 20000
      AND EXISTS (
        SELECT 1 FROM unnest(coalesce(m.postal_codes, '{}'::text[])) AS c
        WHERE c LIKE k || '%'
      )
    ORDER BY
      (k = ANY(coalesce(m.postal_codes, '{}'::text[]))) DESC,
      m.population DESC,
      m.name
    LIMIT n;
  ELSE
    -- Nombre, provincia o comunidad, contra el índice trigram de search_key.
    RETURN QUERY
    SELECT m.code, m.name, m.province, m.population, m.postal_codes
    FROM public.municipalities m
    WHERE m.population < 20000
      AND m.search_key LIKE '%' || k || '%'
    ORDER BY
      (m.search_key LIKE k || '%') DESC,
      m.population DESC,
      m.name
    LIMIT n;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.search_municipalities(text, integer)
  TO anon, authenticated;
