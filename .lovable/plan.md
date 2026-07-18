# Ajuste de tarjetas en el directorio

## Contexto
Actualmente, en `/directorio` la vista de tarjetas (`ProfessionalCard`) muestra una imagen grande con ratio 4/5 ocupando todo el ancho superior de la tarjeta.

## Cambio solicitado
- En la página de directorio, usar un círculo pequeño para la imagen/avatar del profesional, similar al estilo de la vista de lista y las tarjetas de la home.
- Rediseñar la tarjeta para que el avatar circular quede alineado junto al nombre y la información, en lugar de como una imagen de hero de la tarjeta.
- Si no hay foto, usar un círculo con color de la profesión o un ícono `User` centrado.

## Archivos a modificar
- `src/components/ProfessionalCard.tsx`: cambiar el layout de la tarjeta a formato horizontal con avatar circular pequeño.
- Opcionalmente ajustar `src/routes/directorio.tsx` si es necesario adaptar la grid a la nueva forma compacta.

## Resultado esperado
Tarjetas más compactas y consistentes con el resto de la aplicación, donde el avatar es un círculo pequeño.