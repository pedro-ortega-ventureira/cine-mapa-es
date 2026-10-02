-- Los perfiles importados se crearon antes de que existiera professionals.user_id.
-- Se vinculan únicamente cuando hay una coincidencia inequívoca de email y la
-- cuenta todavía no posee un perfil. Los duplicados quedan sin tocar para que
-- un administrador los revise, nunca se asignan a ciegas.

WITH unique_legacy_profiles AS (
  SELECT lower(btrim(email)) AS normalized_email
  FROM public.professionals
  WHERE user_id IS NULL
    AND nullif(btrim(email), '') IS NOT NULL
  GROUP BY lower(btrim(email))
  HAVING count(*) = 1
), candidates AS (
  SELECT p.id AS professional_id, u.id AS user_id
  FROM public.professionals AS p
  JOIN unique_legacy_profiles AS l
    ON lower(btrim(p.email)) = l.normalized_email
  JOIN auth.users AS u
    ON lower(btrim(u.email)) = l.normalized_email
  WHERE p.user_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.professionals AS already_linked
      WHERE already_linked.user_id = u.id
    )
)
UPDATE public.professionals AS p
SET user_id = candidates.user_id
FROM candidates
WHERE p.id = candidates.professional_id
  AND p.user_id IS NULL;
