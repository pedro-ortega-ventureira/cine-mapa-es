# Directorio Audiovisual del Medio Rural — Plan

App full-stack en TanStack Start + Lovable Cloud (Supabase) con mapa de municipios <20.000 hab, directorio, perfiles con filmografía TMDB, panel admin e importación desde Excel.

## Fases de entrega

1. **Fase 1 — Base + datos**: activar Cloud, esquema Supabase, importar dataset municipios INE, seed desde el Excel subido, rutas y layout.
2. **Fase 2 — Mapa y directorio público**: mapa interactivo, listado con filtros, perfil público básico.
3. **Fase 3 — Auth + Admin**: login, panel `/admin`, CRUD, importación Excel con previsualización.
4. **Fase 4 — TMDB y filmografía**: buscador TMDB, cache en `filmography_items`, grid en perfil.
5. **Fase 5 — Extras**: showreel, verificación, métricas, contador de vistas, contacto.

---

## Arquitectura de rutas

```
src/routes/
  __root.tsx                    layout global + nav + auth listener
  index.tsx                     home: mapa + búsqueda + contadores
  directorio.tsx                listado (grid/tabla) con filtros
  profesionales.$slug.tsx       perfil público
  municipios.$codigo.tsx        vista de municipio con sus profesionales
  auth.tsx                      login (Cloud Auth)
  _authenticated/
    admin.tsx                   layout admin
    admin.index.tsx             dashboard con métricas
    admin.profesionales.tsx     CRUD tabla maestra
    admin.importar.tsx          importación Excel con preview
    admin.municipios.tsx        gestión municipios
  api/tmdb.$.ts                 proxy TMDB (protege API key server-side)
```

## Esquema Supabase

**Enums**: `gender_enum`, `availability_enum`, `filmography_type`, `credit_type`, `app_role`.

**Tablas**:

- `municipalities` — `ine_code` (PK), `name`, `province`, `autonomous_community`, `population`, `lat`, `lng`, `postal_codes text[]`. Índice por `province`, `autonomous_community`, `population`. Público read via policy `TO anon` con `population < 20000`.
- `professionals` — todos los campos del brief (personales, ubicación con FK `municipality_code` → municipalities, perfil profesional, `production_types text[]`, `social_links jsonb`, `education/awards jsonb[]`, extras: `reel_url`, `equipment_owned`, `union_membership`, `nif_cif`, `verified`, `profile_views`, `tags`, `slug` único, `date_joined`). RLS: SELECT público solo si `verified=true`; INSERT/UPDATE/DELETE solo admin.
- `filmography_items` — vinculado a `professionals` + campos TMDB (`tmdb_id`, `type`, `poster_url`, `synopsis`, `tmdb_rating`, `role_in_production`, `credit_type`, `custom_note`, `featured`). Índice único (`professional_id`, `tmdb_id`, `type`).
- `user_roles` — patrón estándar (`user_id`, `role app_role`) + función `has_role()` SECURITY DEFINER (evita recursión RLS).
- `import_logs` — auditoría de importaciones Excel (`filename`, `rows_ok`, `rows_updated`, `rows_error`, `errors jsonb`, `imported_by`).
- `contact_messages` — mensajes desde el botón de contacto (privados, admin-only).

Grants explícitos en cada tabla (`authenticated`, `service_role`, `anon` solo donde procede). Todas las mutaciones desde server functions con `requireSupabaseAuth` + `has_role('admin')`.

## Datos de municipios

Descargo dataset público (INE + centroides): CSV con ~8.100 municipios (`código INE`, nombre, provincia, CCAA, población, lat, lng) y lo cargo mediante migración `INSERT` por lotes. Para el mapa uso GeoJSON simplificado de límites provinciales + puntos (centroides) por municipio — evita cargar 8k polígonos en el navegador.

## Mapa interactivo

- **Librería**: `react-simple-maps` con GeoJSON provincial de España + capa de círculos SVG por municipio (centroide). Fallback a Leaflet solo si hace falta clustering.
- **Escala de color** (D3 `scaleThreshold`): 5 tramos por población según brief (gris → azul marino).
- **Tooltip** con nombre, provincia, CCAA, nº profesionales (JOIN cacheado).
- **Click** → panel lateral (`Sheet` de shadcn) con lista de profesionales del municipio.
- **Filtros**: CCAA, provincia, rol, tipo de producción — aplican tanto al mapa (opacidad/tamaño de puntos) como al listado.
- Solo se renderizan municipios con `population < 20000` **y** al menos 1 profesional (opcional toggle "ver todos").

## Integración TMDB

- Server route `/api/tmdb/*` proxya llamadas para no exponer la API key al cliente.
- Endpoints usados:
  - `GET /search/multi?query=` — buscador del admin/perfil.
  - `GET /movie/{id}` y `GET /tv/{id}` — detalle al seleccionar.
  - `GET /movie/{id}/credits` — para modal de elenco/crew.
- Cache: guardamos snapshot completo en `filmography_items` al añadir; no re-consultamos TMDB para render. Job manual "refrescar TMDB" en admin.
- Rate limit: throttle client-side (debounce 350ms).

## Importación Excel

Flujo en `/admin/importar`:
1. Subida `.xlsx` → parseo con SheetJS en el cliente.
2. UI de **mapeo de columnas** (dropdown por columna del Excel → campo del modelo). Auto-detección por nombre de cabecera.
3. **Previsualización** primeras 20 filas con validación (Zod: email, año, código INE, CP→municipio).
4. Botón "Importar" → server function `importProfessionals` (admin-only) que hace UPSERT por (`email`) o (`ine_code` + `full_name`).
5. Registro en `import_logs` con contadores y errores por fila.

**Excel actual**: solo 8 columnas (marca temporal, actividad, CP, roles, interés, email, nombre, RGPD). Mapeo inicial: `CP → municipality_code` vía tabla `postal_codes`, `nombre → full_name`, `email → email`, `roles → primary_role + secondary_roles` (split por comas). El resto de campos quedan vacíos hasta que el profesional complete su perfil.

## Perfil público

- Hero con foto, nombre, alias, municipio + mini-mapa.
- Tags de roles y tipos de producción.
- **Filmografía**: grid de posters TMDB, hover con año/rol, click → modal con sinopsis, rating, crédito en la obra + link a TMDB.
- Secciones: bio, premios (timeline), formación, idiomas, disponibilidad, showreel embed (Vimeo/YouTube).
- Botón "Contactar" → modal con formulario que inserta en `contact_messages`; email real oculto.
- Counter `profile_views` incrementado por RPC.

## Panel admin

- Dashboard: contadores por CCAA, rol, tipo de producción (charts con `recharts`).
- Tabla maestra con filtros, búsqueda, edición inline, verificación (checkbox `verified`).
- Gestión municipios (solo lectura + fix manual de coordenadas si falta).
- Log de importaciones.

## Componentes principales (orden de desarrollo)

1. `MunicipalityMap` + `MapLegend` + `MapFilters`
2. `ProfessionalCard` / `ProfessionalListItem`
3. `DirectoryFilters` (sidebar shadcn)
4. `ProfessionalProfile` + `FilmographyGrid` + `FilmographyModal`
5. `TmdbSearchCombobox`
6. `ExcelImportWizard` (upload → mapeo → preview → resultado)
7. `AdminDashboard` + `AdminProfessionalsTable`
8. `AuthForm` + gate `_authenticated`
9. `ContactMessageDialog`
10. `MunicipalityDetailPanel`

Total estimado: ~25 componentes + 10 rutas + 12 server functions.

## Dependencias externas a instalar

`react-simple-maps`, `d3-scale`, `d3-scale-chromatic`, `topojson-client`, `xlsx` (SheetJS), `recharts`, `zod` (ya suele estar).

## Secretos / configuración

- **Lovable Cloud** (Supabase gestionado) — lo activo al iniciar Fase 1.
- **TMDB_API_KEY** — te lo pediré al llegar a Fase 4 (guardado en Cloud, usado solo desde `api/tmdb.$.ts`).
- Cuenta admin inicial: la creas tras Fase 3 y te doy el SQL para promoverla a `admin` en `user_roles`.

## Riesgos y decisiones abiertas

- Dataset INE de municipios: pesa ~1MB en JSON. Lo indexo en Supabase, no lo sirvo al cliente entero.
- Geocoding de CP → municipio: un CP puede cubrir varios municipios. Al importar el Excel actual, si hay ambigüedad marco el registro como "revisar en admin".
- LOPD/RGPD: los emails y NIF nunca salen en respuestas públicas; RLS + column-level en las server functions.

¿Empiezo por la Fase 1 (activar Cloud + crear esquema + importar dataset municipios + seed Excel)?
