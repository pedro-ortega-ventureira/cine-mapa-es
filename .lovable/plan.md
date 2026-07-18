# Plan: Quitar nombres de municipios en el mapa de la home

## Cambio
En el mapa coroplético de la home (`src/components/MunicipalitiesChoroplethMap.tsx`) se muestran actualmente dos tipos de etiquetas de texto con nombres de municipios:
1. Etiquetas permanentes sobre los polígonos de municipios que tienen profesionales.
2. Etiquetas sobre los puntos/clusters de profesionales.

El usuario solicita eliminar ambas etiquetas y dejar únicamente los puntos de profesionales (círculos de color individuales y clusters).

## Implementación
- En `src/components/MunicipalitiesChoroplethMap.tsx`:
  - Eliminar el bloque que añade `labelMarker` sobre polígonos con profesionales (líneas ~231-259).
  - Eliminar el bloque que añade etiquetas sobre puntos/clusters de profesionales (líneas ~415-439).
  - Conservar intacta la lógica de renderizado de puntos y clusters de profesionales.

## Verificación
- Revisar el preview de la home para confirmar que los puntos de color y clusters siguen visibles, pero ya no aparecen los nombres de municipios superpuestos.
- Comprobar que el build no genera errores.