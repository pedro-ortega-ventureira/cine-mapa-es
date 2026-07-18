Modificaremos la página de perfil público del profesional (`src/routes/profesionales.$slug.tsx`) para:

1. **Mostrar código postal + municipio + provincia** en una única línea de ubicación, usando `raw_postal_code` (disponible en la tabla) y los datos de `municipalities`. El formato será: `CP XXXXX — Municipio, Provincia, CCAA`.
2. **Reducir y redondear la foto de perfil**: cambiar el contenedor actual de aspect-[3/4] y `md:w-56` a un círculo pequeño (aprox. 80×80 px, con posible ajuste responsive).
3. **Reordenar la cabecera del perfil** para que el círculo pequeño quede alineado con el nombre y la información principal (horizontalmente), evitando un bloque lateral muy grande.

No cambiaremos lógica de base de datos ni backend; solo presentación.