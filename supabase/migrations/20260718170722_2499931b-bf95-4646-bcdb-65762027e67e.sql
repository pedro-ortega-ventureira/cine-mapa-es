GRANT SELECT (
  id, slug, full_name, alias, photo_url,
  birth_year, gender, nationality,
  social_links,
  municipality_code, raw_postal_code,
  primary_role, secondary_roles, production_types, bio,
  years_of_experience, languages, education, awards,
  availability, works_remotely, willing_to_travel,
  reel_url, equipment_owned, union_membership,
  verified, profile_views, tags, date_joined, updated_at,
  geo_lat, geo_lng, geo_accuracy, geo_municipality_name, geo_province
) ON public.professionals TO anon;

GRANT SELECT (
  id, slug, full_name, alias, photo_url,
  birth_year, gender, nationality,
  social_links,
  municipality_code, raw_postal_code,
  primary_role, secondary_roles, production_types, bio,
  years_of_experience, languages, education, awards,
  availability, works_remotely, willing_to_travel,
  reel_url, equipment_owned, union_membership,
  verified, profile_views, tags, date_joined, updated_at,
  geo_lat, geo_lng, geo_accuracy, geo_municipality_name, geo_province
) ON public.professionals TO authenticated;
