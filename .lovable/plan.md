## Problema detectado

La búsqueda actual en `/directorio` tiene tres limitaciones:

1. Solo trae 120 filas y filtra en cliente sobre `full_name`, `alias` y `primary_role`. Con más profesionales, muchos quedan fuera antes de filtrar.
2. No entiende sinónimos ni raíces: "guion" o "guionista" no acierta si el rol exacto es "Guionista" y hay tildes/mayúsculas de por medio; "director foto" no encuentra "Director/a de Fotografía".
3. No busca por ubicación textual: escribir "granada" no devuelve profesionales de la provincia de Granada, porque el término nunca se cruza contra `municipalities.province`, `autonomous_community` ni `name`.

Además, la home envía la consulta directamente a `/directorio?q=…`, así que arreglar el directorio arregla también la home.

## Qué se va a construir

Una búsqueda inteligente que interpreta la caja de texto como una combinación de intenciones (rol + ubicación + texto libre) y aplica los filtros correctos automáticamente.

### 1. Normalización y tokenización

- Función común que quita tildes, pasa a minúsculas y separa la consulta en tokens.
- Se aplica tanto a la consulta como a los campos comparables (nombre profesional, alias, rol, tags, municipio, provincia, CCAA).

### 2. Diccionario de roles con sinónimos

Nuevo mapa en `src/lib/roles.ts` (o `constants.ts`) que asocia cada `PRIMARY_ROLE` a una lista de alias normalizados. Ejemplos:

- "Guionista" → ["guion", "guionista", "guionistas", "guiones", "escritor", "escritora"]
- "Director/a de Fotografía" → ["dop", "director foto", "directora foto", "fotografia", "dirfoto"]
- "Director/a" → ["director", "directora", "direccion"]
- "Montador/a" → ["montaje", "montador", "montadora", "editor", "editora"]
- "Sonidista" → ["sonido", "sonidista"]
- "Actriz / Actor" → ["actor", "actriz", "interprete"]
- (etc. para cada rol de `PRIMARY_ROLES`)

Un token que coincida con algún alias marca ese rol como "detectado" y se retira de la parte de texto libre.

### 3. Diccionario de ubicaciones

Se cargará una vez `municipalities` con `code, name, province, autonomous_community` (ya se carga en la página) y se construyen tres índices normalizados:

- Set de provincias ("granada", "cadiz", "cordoba"…)
- Set de comunidades ("andalucia", "canarias"…)
- Set de nombres de municipio

Un token que coincida con provincia se convierte en filtro por provincia; con CCAA en filtro por CCAA; con municipio en filtro por `municipality_code`. El token se retira del texto libre.

### 4. Consulta a la base de datos

Se cambia la query de `professionals` para no depender del límite de 120 en cliente:

- Si se detectan roles: `primary_role IN (...detectados)` o coincidencia también contra `secondary_roles` (array `contains`/`overlaps`).
- Si se detecta provincia/CCAA: se filtra por `municipality_code IN (...códigos de esa provincia/CCAA)`.
- Texto libre restante: `ILIKE` con `%token%` en un `.or()` sobre `full_name`, `alias` y `tags` (texto o array).
- Se sube el `limit` a 500 y se mantiene el orden por `date_joined`.

Los filtros de la barra lateral (Comunidad, Rol, Tipo) siguen funcionando y se combinan con los detectados en el texto — los explícitos ganan sobre los inferidos.

### 5. UI

- Debajo de la caja de búsqueda aparecen "chips" con lo que el sistema interpretó: p. ej. `Rol: Guionista` `Provincia: Granada`, con una X para quitar cada uno.
- Si la consulta no matchea nada estructurado, se hace búsqueda de texto plano.
- La home no necesita cambios: seguirá enviando `?q=` al directorio.

### Detalles técnicos

- Archivos nuevos:
  - `src/lib/search.ts`: `normalize()`, `tokenize()`, `parseQuery(query, munIndex)` que devuelve `{ roles, provinces, ccaa, municipalities, freeText }`.
  - `src/lib/roleSynonyms.ts`: mapa rol → sinónimos.
- Archivos modificados:
  - `src/routes/directorio.tsx`: usa `parseQuery` con el índice construido a partir de `municipalitiesQ`, aplica filtros en la query Supabase y muestra los chips de interpretación.
- Sin cambios de base de datos ni de RLS.
- Consultas Supabase: mantener tipado con `sel = (s: string) => s` si el compilador se ralentiza al ampliar filtros.

### Fuera de alcance

- No se añade full-text search en Postgres (`tsvector`) — el volumen actual no lo justifica.
- No se toca la home más allá de que ya se beneficia al pasar la query.
- No se implementa autocompletado en la caja (solo chips post-parseo).
