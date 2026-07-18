## Problema
En la home, la tarjeta "municipios representados" muestra 0 porque calcula los códigos de municipio asignados a profesionales verificados (`municipality_code`), y actualmente ningún profesional tiene ese campo rellenado.

## Datos reales
- Profesionales verificados: 95
- Municipios con `population < 20000`: 7.718
- Distintos `municipality_code` entre profesionales verificados: 0

## Solución
Actualizar la consulta de estadísticas en `src/routes/index.tsx` para obtener el conteo directamente de la tabla `municipalities` filtrando por `population < 20000`.

### Cambios concretos
- En `statsQ`, reemplazar la segunda consulta (que contaba profesionales agrupados por `municipality_code`) por:
  ```ts
  supabase.from("municipalities").select("*", { count: "exact", head: true }).lt("population", 20000)
  ```
- Usar ese `count` para la tarjeta.
- Renombrar la etiqueta de la tarjeta de "municipios representados" a "municipios menores de 20.000 habitantes" para que coincida con el dato real.
- Mantener la tarjeta de profesionales verificados sin cambios.

### Archivo afectado
- `src/routes/index.tsx`

Si prefieres conservar la etiqueta "municipios representados" aunque el número sea el total de municipios, dímelo y lo ajusto.