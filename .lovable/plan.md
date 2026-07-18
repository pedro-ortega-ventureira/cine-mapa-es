## Diagnóstico

Las peticiones a `professionals` desde la home y `/mapa` devuelven **403 "permission denied for table professionals"**. En la migración de seguridad anterior se revocó `SELECT` a `anon` y se restringió a columnas concretas para `authenticated`, pero por el error `GRANT SELECT ON public.professionals TO authenticated` el rol `anon` (usado por visitantes anónimos) ya no puede leer **ninguna** columna, y `authenticated` tampoco tiene grants sobre las columnas que la home/mapa piden (`geo_lat`, `geo_lng`, `geo_accuracy`, `raw_postal_code`, etc. quedaron fuera).

Consecuencia: el mapa recibe 0 profesionales porque la consulta falla antes de aplicar RLS.

## Plan (una sola migración SQL)

Restaurar grants a nivel de columna sobre `public.professionals` para las columnas **no sensibles** que la UI pública necesita, tanto para `anon` como para `authenticated`. Mantener revocado el acceso a PII (email, teléfono, NIF/CIF) según la política de seguridad ya acordada.

Columnas públicas a conceder (SELECT) a `anon` y `authenticated`:

- Identidad pública: `id`, `slug`, `full_name`, `alias`, `photo_url`, `bio`
- Rol y perfil: `primary_role`, `roles`, `specialties`, `languages`, `showreel_url`, `website_url`, `social_links`
- Estado: `verified`, `date_joined`, `profile_views`, `created_at`, `updated_at`
- Ubicación (no exacta): `municipality_code`, `geo_municipality_name`, `geo_province`, `geo_accuracy`, `raw_postal_code`
- Coordenadas para el mapa: `geo_lat`, `geo_lng` — se conceden porque el mapa las necesita para posicionar puntos; son a nivel municipal (no dirección exacta) y ya se muestran públicamente en el mapa.

Columnas que **siguen sin acceso** para `anon`/`authenticated` (solo `service_role`): `email`, `phone`, `nif_cif`, `address`, y cualquier otra columna de PII/facturación existente.

`service_role` conserva `ALL`.

## Verificación

Tras la migración: recargar `/` y `/mapa`, confirmar que las peticiones a `professionals` devuelven 200 y que los puntos aparecen sobre el mapa coroplético.
