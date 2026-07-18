## Objetivo
Mostrar permanentemente el nombre del municipio sobre su polígono en los mapas Leaflet, empezando por el mapa de ubicación del perfil de profesional y extendiendo al mapa coroplético de la home.

## Cambios planificados

### 1. Mapa de detalle del profesional (`MunicipalityContourMap.tsx`)
- Calcular el centro del polígono del municipio usando `layer.getBounds().getCenter()`.
- Añadir un `L.marker` con un `divIcon` que muestre el nombre del municipio en una etiqueta centrada, con fondo semitransparente, tipografía limpia y sin shadow de marker.
- La etiqueta debe estar por encima del polígono y debajo de los controles de zoom.
- Ajustar el `fitBounds` para que la etiqueta no quede cortada por el borde del mapa (aumentar ligeramente el padding o usar `maxZoom` razonable).

### 2. Mapa coroplético de municipios (`MunicipalitiesChoroplethMap.tsx`)
- Añadir una etiqueta permanente con el nombre del municipio en cada polígono cuando el municipio tenga profesionales (o en todos, según legibilidad).
- Usar la misma técnica de `divIcon` centrado en el polígono.
- En el inset de Canarias, reducir el tamaño de fuente o mostrar solo a partir de cierto zoom para no saturar.
- Mantener los tooltips al hover para información adicional (provincia, población, conteo de profesionales).

## Detalles técnicos
- Usar `L.divIcon` con `className` personalizado para eliminar el estilo por defecto de marker de Leaflet.
- Posicionar con `iconAnchor` en el centro del div para que el texto quede centrado sobre el polígono.
- Añadir estilos inline o clases Tailwind para el fondo, color y padding.
- Asegurar que el label se re-renderiza correctamente cuando cambia el municipio o el color.

## Verificación
- Revisar visualmente en la página de perfil de un profesional que el nombre del municipio aparezca centrado sobre el contorno.
- Revisar en la home que los municipios con profesionales muestren su nombre de forma legible.