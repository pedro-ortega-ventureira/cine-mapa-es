## Cambios en `src/components/MunicipalityContourMap.tsx`

1. **Añadir capa base clara de Leaflet** (tiles) debajo del contorno, para dar contexto geográfico al polígono del municipio. Se usarán las tiles de CARTO Positron (estilo claro, gratuito, sin API key):
   - URL: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`
   - Añadida con `L.tileLayer(...).addTo(map)` antes de dibujar el GeoJSON.
   - Se reactiva `attributionControl` para respetar la atribución de CARTO/OSM.

2. **Eliminar el marcador del profesional**: quitar el bloque `L.circleMarker([lat, lng], ...)` (líneas 93–101). El fallback `map.setView([lat, lng], 11)` cuando no se encuentra el polígono se mantiene para encuadrar la zona.

El resto del componente (carga del GeoJSON, estilo del contorno con el color de la profesión, fitBounds) queda igual.