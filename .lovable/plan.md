## Problema
En la vista actual a escala de toda España (móvil y escritorio) los puntos de profesionales individuales (radio 6) y los clusters (tamaño mínimo 22) quedan apenas visibles sobre los municipios.

## Cambio propuesto
Aumentar el tamaño de los marcadores en `src/components/MunicipalitiesChoroplethMap.tsx` sin cambiar la lógica de agrupación ni el resto del estilo:

- **Profesional individual:** pasar el radio de `6` a `10` (vista principal) y `8` en el recuadro de Canarias.
- **Cluster:** base de `22` a `34`, máximo de `34` a `48`, y factor logarítmico ajustado para que el crecimiento se note.
- **Bordes:** aumentar el grosor del borde blanco de `2` a `3` para mejor contraste sobre los polígonos azules de población.
- **Pane / z-index:** mantener el pane `pros` en `z-index: 650` para que sigan por encima de los municipios.

## Verificación
Recargar la home y el mapa completo, confirmar que los puntos individuales y clusters se distinguen claramente a la escala de España y que los popups siguen funcionando.