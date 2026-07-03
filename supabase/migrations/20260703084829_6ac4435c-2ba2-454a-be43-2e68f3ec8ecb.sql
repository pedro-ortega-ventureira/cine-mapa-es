
-- =============== ENUMS ===============
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'user');
CREATE TYPE public.gender_enum AS ENUM ('Hombre', 'Mujer', 'No binario', 'Prefiero no decirlo');
CREATE TYPE public.availability_enum AS ENUM ('Disponible', 'No disponible', 'Bajo consulta');
CREATE TYPE public.filmography_type AS ENUM ('movie', 'tv', 'short', 'other');
CREATE TYPE public.credit_type AS ENUM ('director', 'writer', 'producer', 'cast', 'crew', 'composer', 'cinematographer', 'editor', 'sound', 'other');

-- =============== MUNICIPALITIES ===============
CREATE TABLE public.municipalities (
  code TEXT PRIMARY KEY,               -- slug provincia-nombre
  name TEXT NOT NULL,
  province TEXT NOT NULL,
  autonomous_community TEXT NOT NULL,
  population INTEGER NOT NULL DEFAULT 0,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  postal_codes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_municipalities_province ON public.municipalities(province);
CREATE INDEX idx_municipalities_community ON public.municipalities(autonomous_community);
CREATE INDEX idx_municipalities_population ON public.municipalities(population);
CREATE INDEX idx_municipalities_name ON public.municipalities(name);

GRANT SELECT ON public.municipalities TO anon, authenticated;
GRANT ALL ON public.municipalities TO service_role;
ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Municipalities are public" ON public.municipalities FOR SELECT USING (true);

-- =============== USER ROLES ===============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "Users can see own roles" ON public.user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============== PROFESSIONALS ===============
CREATE TABLE public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  alias TEXT,
  photo_url TEXT,
  birth_year INTEGER,
  gender gender_enum,
  nationality TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  social_links JSONB DEFAULT '{}'::jsonb,
  municipality_code TEXT REFERENCES public.municipalities(code) ON DELETE SET NULL,
  raw_postal_code TEXT,             -- CP crudo si no se resolvió municipio
  primary_role TEXT,
  secondary_roles TEXT[] DEFAULT '{}',
  production_types TEXT[] DEFAULT '{}',
  bio TEXT,
  years_of_experience INTEGER,
  languages TEXT[] DEFAULT '{}',
  education JSONB DEFAULT '[]'::jsonb,
  awards JSONB DEFAULT '[]'::jsonb,
  availability availability_enum,
  works_remotely BOOLEAN DEFAULT false,
  willing_to_travel BOOLEAN DEFAULT false,
  reel_url TEXT,
  equipment_owned TEXT[] DEFAULT '{}',
  union_membership TEXT,
  nif_cif TEXT,                     -- privado, solo admin
  verified BOOLEAN NOT NULL DEFAULT false,
  profile_views INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  date_joined TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prof_municipality ON public.professionals(municipality_code);
CREATE INDEX idx_prof_verified ON public.professionals(verified);
CREATE INDEX idx_prof_primary_role ON public.professionals(primary_role);
CREATE INDEX idx_prof_full_name ON public.professionals(full_name);
CREATE INDEX idx_prof_email ON public.professionals(email);

GRANT SELECT ON public.professionals TO anon, authenticated;
GRANT ALL ON public.professionals TO service_role;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view verified professionals" ON public.professionals FOR SELECT
  USING (verified = true);
CREATE POLICY "Admins full access professionals" ON public.professionals FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_professionals_updated BEFORE UPDATE ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RPC para incrementar contador de vistas
CREATE OR REPLACE FUNCTION public.increment_profile_views(_slug TEXT)
RETURNS void LANGUAGE SQL SECURITY DEFINER SET search_path = public
AS $$ UPDATE public.professionals SET profile_views = profile_views + 1 WHERE slug = _slug AND verified = true $$;
GRANT EXECUTE ON FUNCTION public.increment_profile_views(TEXT) TO anon, authenticated;

-- =============== FILMOGRAPHY ===============
CREATE TABLE public.filmography_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  tmdb_id INTEGER,
  title TEXT NOT NULL,
  original_title TEXT,
  type filmography_type NOT NULL DEFAULT 'movie',
  year INTEGER,
  role_in_production TEXT,
  credit_type credit_type,
  poster_url TEXT,
  synopsis TEXT,
  tmdb_rating NUMERIC(3,1),
  custom_note TEXT,
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_film_unique ON public.filmography_items(professional_id, tmdb_id, type) WHERE tmdb_id IS NOT NULL;
CREATE INDEX idx_film_professional ON public.filmography_items(professional_id);

GRANT SELECT ON public.filmography_items TO anon, authenticated;
GRANT ALL ON public.filmography_items TO service_role;
ALTER TABLE public.filmography_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view filmography of verified" ON public.filmography_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND p.verified = true));
CREATE POLICY "Admins full access filmography" ON public.filmography_items FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============== IMPORT LOGS ===============
CREATE TABLE public.import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT,
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  rows_updated INTEGER NOT NULL DEFAULT 0,
  rows_error INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.import_logs TO authenticated;
GRANT ALL ON public.import_logs TO service_role;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view import logs" ON public.import_logs FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert import logs" ON public.import_logs FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============== CONTACT MESSAGES ===============
CREATE TABLE public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_msg_professional ON public.contact_messages(professional_id);
GRANT SELECT, INSERT, UPDATE ON public.contact_messages TO authenticated;
GRANT INSERT ON public.contact_messages TO anon;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can send messages" ON public.contact_messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins view messages" ON public.contact_messages FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update messages" ON public.contact_messages FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============== PROFESSIONAL COUNT VIEW (public, agregado por municipio) ===============
CREATE OR REPLACE VIEW public.municipality_stats AS
SELECT m.code, m.name, m.province, m.autonomous_community, m.population, m.lat, m.lng,
       COUNT(p.id)::INTEGER AS professionals_count
FROM public.municipalities m
LEFT JOIN public.professionals p ON p.municipality_code = m.code AND p.verified = true
GROUP BY m.code, m.name, m.province, m.autonomous_community, m.population, m.lat, m.lng;
GRANT SELECT ON public.municipality_stats TO anon, authenticated;
