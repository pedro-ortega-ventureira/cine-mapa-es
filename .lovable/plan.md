## Diagnóstico

El mapa SÍ se renderiza (SVG presente), pero está vacío porque:

1. La casilla **"Solo municipios con profesionales"** está activada por defecto.
2. De los **113 profesionales importados** desde el Excel, **0 tienen `municipality_code`** (el CP no se resolvió a municipio: `municipalities.postal_codes` está vacío para las 8.112 filas).
3. Además, **0 están `verified=true`**, por lo que aunque tuvieran municipio no contarían en la vista pública del mapa.

## Cambios propuestos

### 1. Mapa siempre visible con capa base
- Desactivar por defecto "Solo con profesionales" → verás los ~7.700 municipios como puntos pequeños atenuados coloreados por población.
- Cambiar la lógica del toggle a "Resaltar solo con profesionales" (oculta la capa base cuando se marca), en vez de esconder todo.

### 2. Halo / buffer sobre municipios con profesionales
En `MunicipalityMap.tsx`, para cada municipio con `professionals_count > 0` renderizar **dos círculos concéntricos**:

- **Buffer exterior**: radio 8–18 px (según nº de profesionales), `fill` del color de la escala de población, `fillOpacity ≈ 0.18`, sin borde — actúa como halo/glow.
- **Punto interior**: 3–6 px, sólido, borde blanco (comportamiento actual).

Los municipios sin profesionales se mantienen como puntos pequeños de 1.4 px semi-transparentes (capa base). Efecto: los municipios con actividad "brillan" sobre el mapa base.

### 3. Resolver CP → municipio (para los 113 importados)

**Plan de datos**:
- Descargar dataset público de códigos postales de España (INE / OpenData: ~55.000 pares CP↔municipio, ~1 MB CSV).
- Nueva función RPC `seed_postal_codes_batch(jsonb)` (security definer, misma pauta que `seed_municipalities_batch`) que rellena `municipalities.postal_codes` en lotes.
- Endpoint `/api/public/seed-postal-codes` (uno solo) que descarga el dataset y llama a la RPC. Después la revoco como hicimos con la anterior.

**Backfill de profesionales existentes**:
- Función `backfillMunicipalities` (admin) que recorre `professionals` con `raw_postal_code IS NOT NULL AND municipality_code IS NULL` y resuelve vía `postal_codes @> [cp]`.
- Cuando un CP mapea a **varios municipios** (habitual en zonas rurales agrupadas), se marca el registro con `tags += "revisar-cp"` para que el admin elija manualmente.
- Botón "Resolver CPs pendientes" en `/admin/profesionales` que muestra cuántos quedan.

### 4. Visibilidad de los 113 importados en el mapa
Dos opciones (elijo la B por defecto):

- A) Dejar el mapa mostrando solo `verified=true` → hay que verificarlos uno a uno.
- **B) Contar en el mapa a todos los profesionales con `municipality_code`, verificados o no**, pero seguir ocultando los NO verificados en el perfil público (`/profesionales/:slug`) y en el listado del directorio.
  - Ajuste: crear una vista `municipality_stats_all` (o parametrizar la existente) que cuente `professionals` sin filtro de `verified`. En `/directorio` y perfil público seguimos filtrando por `verified=true`.

Así el mapa muestra ya la actividad importada mientras se validan las fichas.

### 5. Ajustes menores
- Tooltip: mostrar "X profesional(es) · Y verificado(s)" cuando difieran.
- Añadir botón "Verificar todos los importados" en `/admin/profesionales` (bulk update).

## Detalles técnicos

- Ficheros a tocar: `src/components/MunicipalityMap.tsx`, `src/routes/index.tsx`, `src/lib/professionals.functions.ts` (backfill), `src/routes/_authenticated/admin.profesionales.tsx` (botones), migración SQL (RPC `seed_postal_codes_batch`, vista `municipality_stats_all`).
- Dataset postal: uso `https://github.com/inigoflores/ds-codigos-postales-espana` o el CSV de datos.gob.es. Peso final en tabla: sólo el array `postal_codes` en cada municipio, sin tabla auxiliar.
- El halo (buffer) es puramente SVG, sin librerías nuevas.

## Orden de ejecución

1. Migración: RPC `seed_postal_codes_batch` + vista `municipality_stats_all`.
2. Endpoint de carga de CPs + ejecutarlo.
3. Backfill de `municipality_code` en profesionales existentes.
4. Ajustes del mapa (buffer + capa base siempre visible + toggle invertido).
5. Botones admin (verificar todos, resolver CPs pendientes).

¿Procedo?
