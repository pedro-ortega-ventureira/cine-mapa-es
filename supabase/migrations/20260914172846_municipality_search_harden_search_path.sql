-- Fija el search_path de las dos funciones de normalización (aviso
-- function_search_path_mutable del linter de Supabase). Todo lo que usan vive
-- en pg_catalog, que siempre se resuelve, y la llamada cruzada ya va
-- cualificada, así que el search_path vacío es suficiente y es el más estricto.

CREATE OR REPLACE FUNCTION public.municipality_normalize(_s text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT nullif(
    trim(regexp_replace(
      translate(
        lower(coalesce(_s, '')),
        'áàäâãéèëêíìïîóòöôõúùüûñçºª',
        'aaaaaeeeeiiiiooooouuuuncoa'
      ),
      '[^a-z0-9]+', ' ', 'g'
    )),
    ''
  )
$$;

CREATE OR REPLACE FUNCTION public.municipality_search_key(_name text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = ''
AS $$
  WITH base AS (
    SELECT public.municipality_normalize(_name) AS b
  ),
  partes AS (
    SELECT
      b,
      (regexp_match(b, '^(.+) (el|la|los|las|l|els|les|es|sa|ses|o|a|os|as)$'))[1] AS cuerpo,
      (regexp_match(b, '^(.+) (el|la|los|las|l|els|les|es|sa|ses|o|a|os|as)$'))[2] AS articulo
    FROM base
  )
  SELECT CASE
           WHEN cuerpo IS NOT NULL THEN b || ' ' || articulo || ' ' || cuerpo
           ELSE b
         END
  FROM partes
$$;
