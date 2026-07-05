## Objetivo

Mapa real de España con marcadores clusterizados de los 113 profesionales, geolocalizados por su CP de origen (no por `municipality_code`, que hoy no es fiable).

## Estado detectado

- 113 profesionales; 94 con `raw_postal_code`.
- 8.112 municipios cargados, pero `postal_codes` vacío en **todos** (el seed anterior falló porque los `code` son slugs, no INE de 5 dígitos).
- No hay librería de mapas instalada. El `MunicipalityMap.tsx` actual es SVG a mano y se conserva en la home.

## Enfoque

Resolver CP directamente contra un dataset público CP→(lat, lng, municipio, provincia), sin depender de `municipalities.code`. Guardar el resultado en columnas nuevas de `professionals` para que el mapa sea una lectura trivial.

### 1. Datos

Nueva migración añade a `professionals`:

- `geo_lat double precision`
- `geo_lng double precision`
- `geo_accuracy text` — `exact` | `province` | `none`
- `geo_municipality_name text`
- `geo_province text`

Nuevo endpoint `GET /api/public/seed-cp-geo` que:

1. Descarga dataset público (`inigoflores/ds-codigos-postales-espana`, CSV: `codigo_postal, municipio_id (INE), municipio, provincia, latitud, longitud`).
2. Construye dos mapas en memoria: `cp → {lat,lng,muni,prov}` y `prov2 → centroide` (media de lat/lng de los CP de esa provincia).
3. Recorre todos los `professionals`:
   - CP exacto → `geo_accuracy='exact'`, coords del CP.
   - Solo 2 primeros dígitos → `geo_accuracy='province'`, centroide provincial.
   - Sin CP válido → `geo_accuracy='none'`.
4. Escribe vía RPC `set_professional_geo_batch(_payload jsonb)` (SECURITY DEFINER, actualiza solo esos 5 campos).

Botón "Resolver geolocalización" añadido en `/admin/profesionales` que llama al endpoint y muestra el desglose (exactos / aproximados / sin CP).

### 2. Librería de mapa

Instalar `react-leaflet` + `leaflet` + `leaflet.markercluster` + `@types/leaflet`. Tiles de OpenStreetMap (gratis, sin API key). Escalable a miles de marcadores con clustering nativo.

### 3. Nueva ruta `/mapa`

- Mapa Leaflet centrado en península (Canarias visibles al hacer pan/zoom; Leaflet permite ver ambas sin recuadro forzado — si el usuario lo prefiere en recuadro, hacemos un segundo mini-mapa después).
- `MarkerClusterGroup` con los profesionales `exact` + `province`.
- Marcador exacto: pin normal. Marcador aproximado: pin gris translúcido con etiqueta "ubicación aproximada" en el popup.
- Popup por marcador: foto, nombre, alias, rol principal, municipio/provincia, badge "verificado", enlace a la ficha.
- Cluster: número de profesionales; al hacer click, zoom hasta expandir.
- Cabecera con contadores: `X geolocalizados · Y aproximados · Z pendientes`.
- Filtro rápido: checkbox "Solo verificados", checkbox "Ocultar aproximados".
- SSR-safe: el mapa se carga dentro de `<ClientOnly>` (Leaflet toca `window`).

### 4. Navegación

- Añadir enlace "Mapa" en `SiteHeader`.
- El mapa SVG actual de la home se mantiene (es agregado por municipio, no por profesional — cumplen funciones distintas).

### 5. Rendimiento

- Fetch único: `professionals` con `geo_lat not null`, proyectando solo columnas necesarias, cacheado con React Query.
- `MarkerClusterGroup` maneja miles de puntos sin problema.
- Iconos como singletons (no crear `L.Icon` por marcador).

## Ficheros

**Nuevos**
- `supabase/migrations/*_professionals_geo.sql` — columnas + RPC.
- `src/routes/api/public/seed-cp-geo.ts` — carga y resuelve.
- `src/lib/professionals-geo.functions.ts` — server fn admin para disparar el proceso.
- `src/routes/mapa.tsx` — nueva ruta pública.
- `src/components/ProfessionalsLeafletMap.tsx` — componente cliente.

**Modificados**
- `package.json` — añadir deps.
- `src/routes/_authenticated/admin.profesionales.tsx` — botón "Resolver geolocalización".
- `src/components/SiteHeader.tsx` — enlace "Mapa".
- `src/routes/__root.tsx` — `<link>` al CSS de Leaflet y MarkerCluster.

## Confirmación pedida

- ¿OK usar dataset público `inigoflores/ds-codigos-postales-espana` (INE + coordenadas)? Es lo que evita geocodificación de pago.
- ¿Canarias en el mismo mapa con pan/zoom libre (opción por defecto de Leaflet), o quieres el recuadro clásico separado? Lo segundo requiere un segundo `MapContainer` sincronizado y añade complejidad; recomiendo la primera opción.
