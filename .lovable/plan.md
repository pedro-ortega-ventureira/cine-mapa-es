## Objetivo

Añadir al mapa de la home (`MunicipalitiesChoroplethMap`) los profesionales verificados como puntos de color por profesión, encima de los polígonos de municipios, agrupando por código postal cuando haya varios en el mismo CP.

## Datos

`professionals` ya tiene `geo_lat`, `geo_lng`, `geo_accuracy`, `primary_role`, `geo_municipality_name`, `geo_province` y `postal_code` (usado por el resolver de zippopotam.us). Se consultan solo los verificados con `geo_accuracy = 'exact'` (los "province" no tienen sentido como punto sobre un CP concreto).

Ya existe `ROLE_COLORS` en `src/lib/roles.ts` — se reutiliza para el color del punto.

## Cambios

### 1. `src/components/MunicipalitiesChoroplethMap.tsx`

- Añadir prop opcional `professionals: MapPoint[]` con `{ id, slug, full_name, primary_role, postal_code, geo_lat, geo_lng, geo_municipality_name, geo_province }`.
- En el efecto de render, tras dibujar los polígonos, dibujar una capa de puntos por encima (`bringToFront`) tanto en el mapa principal como en el recuadro de Canarias:
  - Agrupar los profesionales por `postal_code` (fallback: clave `lat.toFixed(4)|lng.toFixed(4)` si el CP está vacío).
  - Para cada grupo con **1 profesional**: `L.circleMarker` de radio 6, `fillColor = ROLE_COLORS[primary_role]`, borde blanco de 2px, `fillOpacity 0.95`, `pane` propio "pros" con `zIndex` alto para destacar sobre los polígonos. Popup con nombre, rol (coloreado), municipio/provincia y enlace `/profesionales/{slug}`.
  - Para cada grupo con **≥2 profesionales** ("buffer"): un `L.divIcon` circular ligeramente mayor (radio 10–14 según recuento, tope 18) en color oscuro neutro (`#0f172a`) con el número dentro en blanco y un halo blanco translúcido (box-shadow radial) para diferenciar visualmente. Al hacer click, popup con la lista compacta (nombre + rol en color) enlazando a cada ficha; encabezado con "N profesionales en CP XXXXX — Municipio / Provincia".
  - Los puntos van en el mapa principal si `!isCanarias`, y en el recuadro si `isCanarias` (misma regla que ya se usa para los polígonos, basada en provincia — para el grupo se toma la del primer profesional).
- Crear un `L.pane("pros")` en la inicialización de cada mapa con `zIndex = 650` (por encima de `overlayPane`, por debajo de tooltips).
- Al cambiar `professionals` u `overlayMap`, limpiar la capa de puntos anterior y redibujar.

### 2. `src/routes/index.tsx`

- Nueva query `verified-pros-map` que trae `id, slug, full_name, primary_role, postal_code, geo_lat, geo_lng, geo_municipality_name, geo_province` de `professionals` con `verified = true` y `geo_accuracy = 'exact'`, límite 5000.
- Pasar el resultado como `professionals` al `MunicipalitiesChoroplethMap`.
- Añadir bajo el mapa una leyenda compacta con los colores de las profesiones más frecuentes (reutilizar `ROLE_COLORS`) y una nota "Los círculos oscuros con número agrupan varios profesionales en el mismo código postal".

## Interacción

- Hover sobre un punto: cursor pointer, sin cambiar el estilo del polígono debajo.
- Click sobre punto individual: abre popup con enlace a la ficha.
- Click sobre grupo: popup con lista de fichas del CP.

## Verificación

- La home renderiza los polígonos y encima los puntos coloreados por profesión sin errores en consola.
- CPs con varios profesionales muestran un círculo con el número; el resto muestra un punto único con el color de la profesión.
- Los profesionales de Canarias aparecen en el recuadro, no en el mapa principal.
- Click en un punto abre la ficha correcta.

## Notas

- No cambia `/mapa`, que seguirá con avatares/foto y clustering por proximidad — este cambio es solo para la home.
- No hay cambios en la base de datos.
