
-- Fix Security Definer View: recreate as SECURITY INVOKER
DROP VIEW IF EXISTS public.municipality_stats;
CREATE VIEW public.municipality_stats
WITH (security_invoker = true) AS
SELECT m.code, m.name, m.province, m.autonomous_community, m.population, m.lat, m.lng,
       COUNT(p.id)::INTEGER AS professionals_count
FROM public.municipalities m
LEFT JOIN public.professionals p ON p.municipality_code = m.code AND p.verified = true
GROUP BY m.code, m.name, m.province, m.autonomous_community, m.population, m.lat, m.lng;
GRANT SELECT ON public.municipality_stats TO anon, authenticated;

-- has_role: revoke default public execute; only server (service_role) and RLS internal use it.
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

-- increment_profile_views: keep public but scoped (SECURITY DEFINER needed to bypass RLS on UPDATE)
-- Already granted; nothing extra needed.

-- set_updated_at is a trigger function; revoke public execute.
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;

-- Tighten "Anyone can send messages" — require sender_email + non-empty message
DROP POLICY IF EXISTS "Anyone can send messages" ON public.contact_messages;
CREATE POLICY "Anyone can send messages" ON public.contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(trim(sender_name)) > 0
    AND length(trim(sender_email)) > 3
    AND length(trim(message)) > 0
    AND EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.verified = true)
  );
