
-- 1) Column-level privileges on professionals for anon: hide sensitive columns
REVOKE SELECT ON public.professionals FROM anon;
GRANT SELECT (
  id, slug, full_name, alias, photo_url, birth_year, gender, nationality,
  website, social_links, municipality_code, raw_postal_code, primary_role,
  secondary_roles, production_types, bio, years_of_experience, languages,
  education, awards, availability, works_remotely, willing_to_travel,
  reel_url, equipment_owned, union_membership, verified, profile_views,
  tags, date_joined, updated_at, geo_accuracy, geo_municipality_name, geo_province
) ON public.professionals TO anon;

-- 2) Lock down SECURITY DEFINER admin/bulk functions
REVOKE ALL ON FUNCTION public.seed_municipalities_batch(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_postal_codes_batch(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_professional_geo_batch(jsonb) FROM PUBLIC, anon, authenticated;

-- 3) has_role: only signed-in users
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- 4) increment_profile_views: keep public (intentional for view counting on public profile pages)
--    (no change; stays available to anon and authenticated)
