-- Vínculo entre un profesional y su persona en TMDB (themoviedb.org). Con
-- este id se puede traer de una sola vez toda su filmografía conocida vía
-- GET /person/{tmdb_person_id}/combined_credits, en vez de tener que buscar
-- y añadir cada título a mano.
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS tmdb_person_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_prof_tmdb_person ON public.professionals(tmdb_person_id)
  WHERE tmdb_person_id IS NOT NULL;

-- El SELECT de professionals está restringido por columnas para anon/
-- authenticated (ver migraciones del 18/07); hay que exponer explícitamente
-- también esta columna nueva o quedará invisible para ambos roles.
GRANT SELECT (tmdb_person_id) ON public.professionals TO anon, authenticated;
