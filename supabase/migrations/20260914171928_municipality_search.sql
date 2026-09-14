-- Búsqueda de municipios en servidor (14/09/2026).
--
-- CAUSA DEL FALLO
-- El buscador de municipios de /registro cargaba la lista entera de municipios
-- elegibles en el cliente y filtraba ahí:
--
--     .from("municipalities").lt("population", 20000).order("name").limit(20000)
--
-- PostgREST corta las respuestas a 1.000 filas (`max-rows`), y `.limit()` no
-- levanta ese tope: es del servidor. Con el orden por `name`, el formulario
-- solo conocía los municipios de la "A" a "Beleña" — 1.000 de los 7.718
-- elegibles. El 87% de los municipios del directorio eran inseleccionables, y
-- todos los fallos reportados (Casabermeja, Esporles, Manzanares el Real,
-- Pesquera (La), Villafranca del Bierzo) caen detrás de ese corte.
--
-- SEGUNDO PROBLEMA: los artículos pospuestos
-- El INE escribe "Pesquera (La)", "Coruña (A)", "Pobla (Sa)". Quien busca
-- escribe "La Pesquera". Aunque la lista estuviera completa, no habría match.
-- Son 544 municipios elegibles, el 7% del directorio.
--
-- Todo aquí es aditivo: ninguna columna, fila o función existente cambia de
-- comportamiento.
--
-- NOTA: esta migración se corrige en las tres siguientes del mismo día
-- (search_path, unificación de sobrecargas y uso del índice). Se conserva tal
-- y como se aplicó para que el historial del repo case con el de la base de
-- datos; el estado final es el de 20260914180745.

-- =====================================================================
-- 1) Normalización
-- =====================================================================

-- Minúsculas, sin acentos, sin puntuación, espacios colapsados.
-- Se usa `translate` en vez de `unaccent()` a propósito: unaccent no es
-- IMMUTABLE (depende de un diccionario), así que no puede usarse en un índice.
CREATE OR REPLACE FUNCTION public.municipality_normalize(_s text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
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

-- Clave de búsqueda de un municipio. Si el nombre lleva el artículo pospuesto
-- al estilo del INE, se añade también la forma natural:
--   "Pesquera (La)"  -> "pesquera la la pesquera"
--   "Coruña (A)"     -> "coruna a a coruna"
-- Así un LIKE '%la pesquera%' encuentra la ficha igual que '%pesquera%'.
CREATE OR REPLACE FUNCTION public.municipality_search_key(_name text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
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

-- =====================================================================
-- 2) Columna de búsqueda, mantenida por trigger
-- =====================================================================
-- Incluye nombre, provincia y comunidad para que "cuenca" o "balears"
-- devuelvan sus municipios, igual que hacía el filtro en cliente.

ALTER TABLE public.municipalities ADD COLUMN IF NOT EXISTS search_key text;

CREATE OR REPLACE FUNCTION public.municipalities_set_search_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  new.search_key := concat_ws(
    ' ',
    public.municipality_search_key(new.name),
    public.municipality_normalize(new.province),
    public.municipality_normalize(new.autonomous_community)
  );
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS trg_municipalities_search_key ON public.municipalities;
CREATE TRIGGER trg_municipalities_search_key
  BEFORE INSERT OR UPDATE OF name, province, autonomous_community
  ON public.municipalities
  FOR EACH ROW EXECUTE FUNCTION public.municipalities_set_search_key();

-- Backfill de las filas que ya existen.
UPDATE public.municipalities
SET search_key = concat_ws(
  ' ',
  public.municipality_search_key(name),
  public.municipality_normalize(province),
  public.municipality_normalize(autonomous_community)
);

-- =====================================================================
-- 3) Índice
-- =====================================================================
-- La búsqueda es por subcadena (LIKE '%algo%'), que un btree no puede servir.
-- pg_trgm sí. Con 8.112 filas un seq scan tampoco dolería, pero el índice deja
-- la búsqueda en ~10 ms en vez de ~128, y esta tabla casi nunca se escribe.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_municipalities_search_key_trgm
  ON public.municipalities USING gin (search_key extensions.gin_trgm_ops);

-- =====================================================================
-- 4) Función de búsqueda
-- =====================================================================
-- SECURITY INVOKER: `municipalities` ya es legible por anon (el formulario la
-- consulta con la clave publicable), así que no hace falta elevar privilegios.
CREATE OR REPLACE FUNCTION public.search_municipalities(
  _q text,
  _max_population integer DEFAULT NULL,
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
  WHERE q.k IS NOT NULL
    AND length(q.k) >= 2
    AND (_max_population IS NULL OR m.population < _max_population)
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
    (m.search_key LIKE q.k || '%') DESC,
    m.population DESC,
    m.name
  LIMIT least(greatest(coalesce(_limit, 30), 1), 50)
$$;

GRANT EXECUTE ON FUNCTION public.search_municipalities(text, integer, integer)
  TO anon, authenticated;
