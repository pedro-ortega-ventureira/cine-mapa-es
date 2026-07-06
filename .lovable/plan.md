## Objetivo

Mejorar `/mapa` para que muestre **solo profesionales verificados**, cada uno con un **pin reconocible** en su ubicación exacta (derivada del código postal), y dibujar el **perfil de España** incluyendo Baleares y Canarias como referencia visual.

## Cambios

### 1. Filtrar a solo verificados por defecto
- `src/routes/mapa.tsx`: el loader/consulta ya trae profesionales con `geo_lat/geo_lng` no nulos; añadir filtro `verified = true` de base.
- El toggle "solo verificados" se elimina (ya es la norma). Se mantiene el toggle "solo ubicación exacta" para ocultar los aproximados de provincia.
- Contadores del header: `X verificados geolocalizados · Y aproximados`.

### 2. Pin reconocible por profesional
En `ProfessionalsLeafletMap.tsx` reemplazar el icono azul genérico de Leaflet por un **marcador circular con la foto** del profesional (o iniciales si no hay foto):
- `L.divIcon` con un `<div>` redondo de 36 px, borde blanco, sombra sutil, color de acento del proyecto.
- Si `photo_url` existe → `background-image` con la foto recortada en círculo.
- Si no → iniciales sobre fondo de color derivado del `id` (hash → hue) para que cada profesional sea distinguible.
- Badge verde de "verificado" en la esquina inferior derecha del pin.
- Los aproximados (provincia) mantienen el círculo gris punteado actual, sin foto (para no engañar sobre la precisión).
- Clustering sigue activo; al hacer zoom aparecen los pines individuales.

### 3. Perfil de España (Península + Baleares + Canarias)
Añadir una capa GeoJSON de contorno nacional bajo los marcadores:
- Fuente: GeoJSON público ligero de comunidades autónomas de España (`https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/spain-communities.geojson` o equivalente cacheable). Se descarga una sola vez desde el cliente y se cachea en `sessionStorage`.
- Estilo: relleno muy tenue (`hsl(var(--muted))` ~15% opacidad), borde fino del color de texto secundario. No interactivo.
- Con la capa, Canarias y Baleares quedan visibles como parte del mapa base sin recuadro artificial — el usuario puede hacer pan/zoom.
- Ajuste inicial: `fitBounds` a la unión de (contorno de España) + (marcadores), con un `maxZoom` bajo (5–6) para que todo el país sea visible al entrar.

### 4. Popup del pin
Se mantiene el popup actual (foto, nombre, alias, rol, municipio/provincia, badge verificado, enlace a ficha). Sin cambios de datos.

### 5. Rendimiento
- Icono con foto se genera on-demand por marcador pero se cachea por `photo_url` en un `Map` en el módulo para no reconstruir HTML idéntico.
- El GeoJSON se pide una sola vez por sesión.
- `MarkerClusterGroup` sigue absorbiendo el crecimiento a miles.

## Archivos afectados
- `src/routes/mapa.tsx` — filtrar `verified=true`, quitar toggle "solo verificados", ajustar contadores.
- `src/components/ProfessionalsLeafletMap.tsx` — nuevo icono con foto/iniciales, capa GeoJSON del contorno de España, `fitBounds` combinado.
- Sin migraciones, sin nuevas dependencias, sin cambios de backend.

## Fuera de alcance
- Recuadro insertado estilo AEMET para Canarias (se usa pan/zoom libre, que fue tu preferencia previa).
- Re-geocodificación de profesionales (ya se hace desde `/admin/profesionales` con "Resolver geolocalización").
- Cambios en la ficha del profesional o en el mapa municipal de la home.

¿Lo lanzo así?
