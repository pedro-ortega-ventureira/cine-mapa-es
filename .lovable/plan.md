## Diagnóstico

El error runtime `Cannot access 'f' before initialization` en `MunicipalitiesChoroplethMap.tsx` viene de este patrón:

```ts
const mainLayer = L.geoJSON(fc, {
  onEachFeature: (feature, lyr) => bindFeature(mainLayer, feature, lyr),
});
```

Leaflet invoca `onEachFeature` de forma síncrona **durante** `L.geoJSON(...)` (dentro de `addData` → `initialize`). En ese momento la `const mainLayer` todavía está en la Temporal Dead Zone, así que al primer feature se lanza el ReferenceError, se rompe el render y el mapa queda en blanco. Lo mismo ocurre con `insetLayer`.

El mapa `/mapa` (`ProfessionalsLeafletMap`) no tiene este patrón, así que sigue funcionando; el fallo es exclusivo del coroplético de la home.

## Cambios

Archivo único: `src/components/MunicipalitiesChoroplethMap.tsx`.

1. Eliminar la captura del layer dentro de `onEachFeature`. El único sitio donde se usaba era `layer.resetStyle(...)` en `mouseout`.
2. Sustituir esa llamada por aplicar directamente el estilo calculado del feature:
   - Extraer el objeto de estilo a una función pura `computeStyle(feature)` (lo que hoy hay dentro de `styleFn`).
   - Usar `styleFn` como `style` del `L.geoJSON` igual que ahora.
   - En `mouseout`, hacer `(e.target as L.Path).setStyle(computeStyle(feature))` en lugar de `layer.resetStyle`.
3. Mantener `mouseover` con el resaltado (`weight: 2, color: "#0f172a"`) tal cual.
4. Dejar el resto (tooltip, click → `onSelectMunicipality`, filtrado península/Canarias, recuadro Canarias) sin cambios.

No hay cambios en `ProfessionalsLeafletMap.tsx`, rutas ni datos.

## Verificación

- Recargar `/` y confirmar que el mapa de municipios renderiza (península + Baleares) y que el recuadro de Canarias también aparece.
- Pasar el ratón sobre un municipio: se resalta y al salir vuelve a su color coroplético original.
- Consola sin `Cannot access 'f' before initialization`.
