## Causa real del fallo

Los `primary_role` en la base de datos no coinciden con la lista `PRIMARY_ROLES` del código. En la BD son cadenas multi-rol separadas por `;` con esta taxonomía real (13 roles canónicos):

- Dirección / Realización
- Dirección de fotografía / Cámara
- Guion
- Producción
- Montaje / Edición
- Sonido
- Música / Composición
- Arte / Decorados / Vestuario
- Efectos visuales / Animación
- Distribución / Gestión cultural / Marketing
- Docencia / Investigación
- Finanzas / Administración
- Otros / Multidisciplinar

Muchos profesionales tienen valores como `"Dirección / Realización; Guion; Producción"`. Mi sinonimario apuntaba a `"Guionista"`, `"Director/a"`, etc., que no existen en BD, y filtraba con `.eq("primary_role", ...)`, así que nunca acertaba. Por eso "guion" o "guión" no da resultados coherentes.

## Corrección

### 1. Reescribir `src/lib/roleSynonyms.ts` con la taxonomía real

Mapear los 13 roles canónicos a sus sinónimos normalizados. Ejemplos:

- `Guion` → `guion`, `guionista`, `guionistas`, `guiones`, `escritor`, `escritora`, `escritura`
- `Dirección / Realización` → `director`, `directora`, `direccion`, `realizador`, `realizadora`, `realizacion`
- `Dirección de fotografía / Cámara` → `dop`, `dp`, `fotografia`, `director de fotografia`, `directora de fotografia`, `camara`, `operador`, `operadora`
- `Montaje / Edición` → `montaje`, `montador`, `montadora`, `edicion`, `editor`, `editora`
- `Producción` → `produccion`, `productor`, `productora`, `producer`
- `Sonido` → `sonido`, `sonidista`, `microfonista`, `mezclador`, `mezcladora`
- `Música / Composición` → `musica`, `composicion`, `compositor`, `compositora`, `bso`, `banda sonora`
- `Arte / Decorados / Vestuario` → `arte`, `decorados`, `vestuario`, `figurinista`, `escenografia`
- `Efectos visuales / Animación` → `vfx`, `efectos visuales`, `animacion`, `animador`, `animadora`
- `Distribución / Gestión cultural / Marketing` → `distribucion`, `marketing`, `gestion cultural`, `distribuidor`, `distribuidora`
- `Docencia / Investigación` → `docencia`, `docente`, `profesor`, `profesora`, `investigacion`, `investigador`, `investigadora`
- `Finanzas / Administración` → `finanzas`, `administracion`, `administrativo`, `administrativa`, `contable`
- `Otros / Multidisciplinar` → `otros`, `multidisciplinar`

### 2. Cambiar el filtro por rol en `src/routes/directorio.tsx`

Como `primary_role` es texto multi-rol con separador `;`, sustituir `.eq(...)` / `.in(...)` por:

- Un `.or("primary_role.ilike.%Guion%,primary_role.ilike.%Dirección / Realización%,...")` con los roles detectados. Los patrones usan las cadenas canónicas con acentos, tal como están en BD.
- Escapar comas dentro de los valores del `or()` (los roles canónicos no contienen comas, así que basta con envolver bien).
- Mantener el filtrado adicional cliente por texto libre.

Los filtros del panel lateral (`search.rol`) también pasan a usar el mismo ILIKE en lugar de `.eq()` y `PRIMARY_ROLES` se sustituye por la lista real de 13 roles canónicos para que el selector muestre valores que existen de verdad.

### 3. Ajustar `PRIMARY_ROLES` en `src/lib/constants.ts`

Reemplazarlo por la lista canónica de 13 roles reales de BD. Esto arregla también el selector "Rol principal" del panel lateral, que ahora ofrece opciones que no existen en los datos.

### 4. Chips y `secondary_roles`

- Los chips ya mostrarán el rol canónico correcto (por ejemplo `Rol: Guion`).
- El filtro seguirá también aplicando ILIKE contra `primary_role` (que ya contiene la lista completa de roles del profesional separada por `;`), así que no hace falta tocar `secondary_roles`.

### Fuera de alcance

- No se normaliza la BD (no se separan los multi-rol en filas propias); se busca dentro del string tal como está.
- No se tocan las provincias / CCAA / municipios: eso ya funciona bien.
