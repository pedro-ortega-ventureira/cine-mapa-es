-- Reparación del registro público de profesionales + sincronización del repo
-- con el estado real de la base de datos (09/09/2026).
--
-- CAUSA DEL FALLO
-- La base de datos tiene el trigger `trg_municipio_menor_20k`, creado
-- directamente sobre producción y ausente del repo, que aborta el INSERT si
-- `municipality_code` es NULL:
--     "Falta municipality_code: solo se admiten altas en municipios de menos
--      de 20.000 habitantes"
-- El formulario de /registro, en cambio, pedía escribir el CÓDIGO del
-- municipio a mano en un campo opcional (placeholder "p.ej. madrid-madrid").
-- Dejarlo vacío -> esa excepción; escribirlo mal -> "Municipio % no existe".
-- Resultado: ningún alta pública había llegado a completarse nunca
-- (professionals.user_id no nulo = 0 filas). El formulario ya solo permite
-- elegir municipios elegibles de un buscador, y la server function valida
-- antes de insertar.
--
-- Esta migración es idempotente: documenta en el repo todo lo que ya existía
-- solo en producción (columnas geo_*, active, exclusion_reason, el trigger de
-- los 20.000 habitantes) y corrige dos fugas reales descritas más abajo.

-- =====================================================================
-- 1) Estado que ya existía en producción pero no en las migraciones
-- =====================================================================

-- Geolocalización de la ficha (la usan src/lib/professionals-geo.functions.ts
-- y los mapas; los GRANT de las migraciones del 18/07 ya la mencionaban).
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS geo_lat double precision;
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS geo_lng double precision;
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS geo_accuracy text;
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS geo_municipality_name text;
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS geo_province text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.professionals'::regclass
      AND conname = 'professionals_geo_accuracy_check'
  ) THEN
    ALTER TABLE public.professionals
      ADD CONSTRAINT professionals_geo_accuracy_check
      CHECK (geo_accuracy = ANY (ARRAY['exact'::text, 'province'::text, 'none'::text]));
  END IF;
END $$;

-- Exclusión de fichas que incumplen la regla del directorio: no se borran,
-- se marcan (decisión ya tomada sobre los registros de Madrid capital).
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS exclusion_reason text;
CREATE INDEX IF NOT EXISTS idx_prof_active ON public.professionals(active) WHERE NOT active;

-- Vínculo perfil <-> cuenta de auth (migración 20260719120000, reaplicada
-- aquí para que el repo sea autocontenido).
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS professionals_user_id_key
  ON public.professionals(user_id)
  WHERE user_id IS NOT NULL;

DROP POLICY IF EXISTS "Users can insert their own professional profile" ON public.professionals;
CREATE POLICY "Users can insert their own professional profile"
  ON public.professionals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own professional profile" ON public.professionals;
CREATE POLICY "Users can update their own professional profile"
  ON public.professionals FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT INSERT, UPDATE, DELETE ON public.professionals TO authenticated;

-- `user_id` NO se expone a anon/authenticated a propósito: la lectura del
-- perfil propio va por server functions con service_role, y publicarlo
-- permitiría correlacionar fichas del directorio con cuentas de auth.

-- La regla de los 20.000 habitantes, tal y como está en producción, ahora
-- versionada. Es la última línea de defensa: la validación de cara al usuario
-- vive en src/lib/public-registration.functions.ts, que devuelve mensajes
-- legibles antes de llegar hasta aquí.
CREATE OR REPLACE FUNCTION public.check_municipio_menor_20k()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  pob integer;
BEGIN
  IF tg_op = 'INSERT' AND new.municipality_code IS NULL THEN
    RAISE EXCEPTION 'Falta municipality_code: solo se admiten altas en municipios de menos de 20.000 habitantes';
  END IF;
  IF new.municipality_code IS NOT NULL THEN
    SELECT population INTO pob FROM public.municipalities WHERE code = new.municipality_code;
    IF pob IS NULL THEN
      RAISE EXCEPTION 'Municipio % no existe en municipalities', new.municipality_code;
    END IF;
    IF pob >= 20000 THEN
      RAISE EXCEPTION 'Municipio % tiene % habitantes: supera el límite de 20.000', new.municipality_code, pob;
    END IF;
  END IF;
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS trg_municipio_menor_20k ON public.professionals;
CREATE TRIGGER trg_municipio_menor_20k
  BEFORE INSERT OR UPDATE OF municipality_code ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.check_municipio_menor_20k();

-- =====================================================================
-- 2) Fuga: las fichas excluidas seguían apareciendo en el directorio
-- =====================================================================
-- `active = false` + `exclusion_reason` marcaba 39 fichas como excluidas, pero
-- ni la política RLS ni las consultas públicas miraban `active`: 22 de ellas
-- (5 de Madrid capital) seguían visibles porque tenían `verified = true`.
-- Se corrige en la política, que es lo que protege todas las vías de acceso,
-- en lugar de tener que acordarse de filtrar en cada consulta del frontend.
DROP POLICY IF EXISTS "Public can view verified professionals" ON public.professionals;
CREATE POLICY "Public can view verified professionals"
  ON public.professionals FOR SELECT
  USING (verified = true AND active = true);

-- La vista de agregados por municipio pertenece a `postgres`, así que no pasa
-- por RLS: hay que excluir las inactivas también aquí o los contadores del
-- mapa y de la portada seguirían contándolas. (La definición en producción
-- también había divergido del repo: incluye `verified_count`, que usa la
-- portada, y contaba TODAS las fichas del municipio en `professionals_count`.)
CREATE OR REPLACE VIEW public.municipality_stats AS
SELECT m.code,
       m.name,
       m.province,
       m.autonomous_community,
       m.population,
       m.lat,
       m.lng,
       count(p.id)::integer AS professionals_count,
       count(p.id) FILTER (WHERE p.verified)::integer AS verified_count
FROM public.municipalities m
     LEFT JOIN public.professionals p
            ON p.municipality_code = m.code AND p.active = true
GROUP BY m.code, m.name, m.province, m.autonomous_community, m.population, m.lat, m.lng;
GRANT SELECT ON public.municipality_stats TO anon, authenticated;
