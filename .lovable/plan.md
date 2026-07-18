## Objetivo

Sustituir las capas actuales del mapa (puntos SVG en la home + capa de referencia de España en `/mapa`) por los polígonos de los 7.707 municipios <20.000 hab del GeoPackage subido, coloreando cada polígono por población (menos habitantes → color más intenso).

## Datos de partida

GeoPackage `municipios_espana_menos_20000_habitantes.gpkg`:
- 7.707 features MULTIPOLYGON en EPSG:4326
- Campos: `Codigo_INE`, `Municipio`, `Provincia`, `Codigo_Postal`, `Habitantes`
- Bounding box cubre península, Baleares y Canarias

## Pasos

### 1. Convertir GPKG → GeoJSON simplificado (build-time, una sola vez)
- Instalar `gdal` en la sandbox y ejecutar `ogr2ogr` para exportar a GeoJSON en EPSG:4326 con simplificación topológica (`-simplify 0.0005`, ~55m) para reducir tamaño manteniendo forma.
- Renombrar campos a minúsculas (`codigo_ine`, `municipio`, `provincia`, `codigo_postal`, `habitantes`).
- Guardar el resultado como `public/geo/municipios-lt20k.geojson` para servirlo estático (una sola descarga cacheable).
- Objetivo de tamaño: <4 MB gzipped. Si supera, aumentar tolerancia de simplificación.

### 2. Escala de color por población (menos → más intenso)
- Buckets cuantiles: `<500`, `500–2k`, `2k–5k`, `5k–10k`, `10k–20k`.
- Rampa secuencial (más oscuro = menos habitantes) sobre el color primario del tema. Se define en `src/lib/constants.ts` reemplazando `POPULATION_BUCKETS` actuales para invertir la intensidad.

### 3. Home (`src/routes/index.tsx` + `MunicipalityMap.tsx`)
- Retirar el SVG casero con puntos y el inset de Canarias.
- Renderizar en su lugar un mapa Leaflet (mismo stack ya usado en `/mapa`) con:
  - Capa base OSM.
  - Capa GeoJSON de municipios coloreada por `habitantes` según la escala del paso 2.
  - Superpuesto: halo/marcador para municipios con `professionals_count > 0` (se sigue leyendo de `municipality_stats`; se cruza por `Codigo_INE`).
  - Tooltip on hover con nombre, provincia, habitantes y nº de profesionales/verificados.
  - Toggle "Ocultar municipios sin profesionales" filtra qué polígonos se pintan rellenos vs. contorno tenue.
- Componente nuevo `src/components/MunicipalitiesChoroplethMap.tsx` (cargado lazy con `ClientOnly`, como el mapa actual de `/mapa`). Se retira `MunicipalityMap.tsx` cuando quede sin usos.

### 4. `/mapa` (`src/routes/mapa.tsx` + `ProfessionalsLeafletMap.tsx`)
- Eliminar la capa GeoJSON actual de contorno de España/Baleares/Canarias (`src/lib/spain-provinces.ts`).
- Añadir la misma capa coroplética de municipios <20k como base, por debajo de los marcadores de profesionales.
- La leyenda pasa a mostrar la escala de habitantes en lugar del contorno decorativo.

### 5. Matching profesionales ↔ municipios
- La tabla `municipality_stats` ya expone `code` (INE 5 dígitos). El GeoJSON usa `codigo_ine` con el mismo formato → join directo en cliente por igualdad de string.
- No requiere cambios de base de datos.

## Detalles técnicos

- Conversión: `ogr2ogr -f GeoJSON -t_srs EPSG:4326 -simplify 0.0005 -sql "SELECT Codigo_INE AS codigo_ine, Municipio AS municipio, Provincia AS provincia, Codigo_Postal AS codigo_postal, Habitantes AS habitantes FROM municipios" public/geo/municipios-lt20k.geojson /tmp/m.gpkg`.
- Servido como estático desde `/geo/municipios-lt20k.geojson`; el cliente lo carga con `fetch` una vez y cachea con React Query (`staleTime: Infinity`).
- Leaflet + `react-leaflet` ya instalados. Uso de `GeoJSON` con `style` función de `habitantes` y `onEachFeature` para tooltip.
- Rendimiento con 7.707 polígonos simplificados es aceptable en Leaflet; si notamos lag se hace fallback a `leaflet.vectorgrid` o a servir TopoJSON. No lo añado ahora salvo que el smoke test lo requiera.

## Archivos a crear / modificar

- Crear `public/geo/municipios-lt20k.geojson` (generado por script una vez).
- Crear `src/components/MunicipalitiesChoroplethMap.tsx`.
- Modificar `src/lib/constants.ts` (buckets + colores invertidos).
- Modificar `src/routes/index.tsx` (usar el nuevo mapa).
- Modificar `src/routes/mapa.tsx` y `src/components/ProfessionalsLeafletMap.tsx` (retirar spain-provinces, añadir capa coroplética).
- Eliminar `src/components/MunicipalityMap.tsx` y `src/lib/spain-provinces.ts` una vez sin referencias.
