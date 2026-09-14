-- Unifica las dos versiones de search_municipalities en una sola.
--
-- Había dos sobrecargas vivas en producción:
--   search_municipalities(_q text, _limit integer)                  -- 20260912094031
--   search_municipalities(_q text, _max_population int, _limit int) -- 20260914171928
--
-- La primera venía de un intento anterior de arreglar lo mismo, cuya migración
-- sí llegó a la base de datos aunque su cambio de frontend se quedó sin
-- aplicar en un .patch. La segunda es la de hoy.
--
-- Con las dos vivas, la llamada del formulario ({_q, _limit} vía PostgREST) es
-- ambigua y Postgres la rechaza:
--
--   ERROR 42725: function public.search_municipalities(_q => unknown,
--                _limit => integer) is not unique
--
-- Es decir: el alta no habría fallado al encontrar el municipio, habría
-- fallado entera en cuanto alguien tecleara dos letras.
--
-- Se conserva la firma de dos argumentos, que es la que esperan el frontend y
-- src/integrations/supabase/types.ts, con el cuerpo nuevo: clave de búsqueda
-- indexada, artículos pospuestos ("La Pesquera" -> "Pesquera (La)") y
-- comodines LIKE neutralizados por la normalización.

DROP FUNCTION IF EXISTS public.search_municipalities(text, integer, integer);

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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH q AS (
    SELECT
      public.municipality_normalize(_q) AS k,
      nullif(regexp_replace(coalesce(_q, ''), '\D', '', 'g'), '') AS cp
  )
  SELECT m.code, m.name, m.province, m.population, m.postal_codes
  FROM public.municipalities m, q
  WHERE m.population < 20000
    AND q.k IS NOT NULL
    AND length(q.k) >= 2
    AND (
      m.search_key LIKE '%' || q.k || '%'
      OR (
        q.cp IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM unnest(coalesce(m.postal_codes, '{}'::text[])) AS c
          WHERE c LIKE q.cp || '%'
        )
      )
    )
  ORDER BY
    (q.cp IS NOT NULL AND q.cp = ANY(coalesce(m.postal_codes, '{}'::text[]))) DESC,
    (m.search_key LIKE q.k || '%') DESC,
    m.population DESC,
    m.name
  LIMIT least(greatest(coalesce(_limit, 30), 1), 50)
$$;

GRANT EXECUTE ON FUNCTION public.search_municipalities(text, integer)
  TO anon, authenticated;
