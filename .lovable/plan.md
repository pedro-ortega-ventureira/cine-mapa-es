## Objetivo

1. Que el filtro inteligente del directorio funcione realmente (hoy sigue devolviendo resultados que no corresponden con la búsqueda escrita).
2. Añadir en `/directorio` un mapa tipo home, pero pintando **solo los profesionales filtrados**.

## 1) Filtro: diagnóstico y corrección

Los datos en BD son correctos (`primary_role` = lista canónica separada por `; `, p.ej. `"Dirección / Realización; Guion; Producción"`, y `ILIKE '%Guion%'` sobre esos strings devuelve 16 filas coherentes). Es decir, el filtro SQL es correcto en aislamiento. El fallo está en la capa de parseo/aplicación de `src/routes/directorio.tsx` + `src/lib/search.ts`:

### Bugs concretos que veo en el código

- **Match de sinónimos demasiado agresivo.** `parseQuery` consume TODOS los sinónimos que aparezcan como palabra en la query. Con textos largos como "director de fotografia" primero cae la frase larga (correcto), pero con inputs sueltos como "dirección" también entra en `Dirección / Realización` porque `direccion` está listado; y "productor" no marca nada como texto libre porque ya se consumió. Hay que confirmar que el usuario obtiene lo que espera y no una unión inesperada.
- **`freeText` restante se aplica como AND sobre todos los tokens.** Cuando el sinónimo se consume mal, `freeText` queda con palabras cortas ("de", "la"…) que casi todos los perfiles contienen → aparentemente "no filtra nada". Necesito ignorar tokens de <=2 chars y stopwords ("de","la","el","y").
- **Chip "Rol" no borra el texto correcto.** `removeToken` recibe el nombre canónico (`Guion`), no el sinónimo escrito por el usuario (`guionista`), así que el regex no encuentra la palabra en el input y el chip parece no borrarse — el usuario cree que el filtro está "pegado".
- **`enabled` de React Query.** `enabled: municipalitiesQ.isSuccess || !search.q` deja la query desactivada durante el primer render con `?q=` hasta que carguen 7.700 municipios. La lista tarda en aparecer y da sensación de "no filtra". Cambio a que se lance con `q` incluso sin municipios (los filtros por provincia/CCAA se aplican cuando el índice esté listo, vía `queryKey` que ya incluye `parsed`).
- **Filtro por rol en cadenas multi-rol.** Ya usa `ilike '%Rol%'`, correcto. Pero cuando hay varios roles inferidos, el `.or("primary_role.ilike.%X%,primary_role.ilike.%Y%")` es OR, no AND — mantengo OR (comportamiento esperado) y lo documento.

### Cambios

1. **`src/lib/search.ts`**
   - `parseQuery`: filtrar `freeText` para descartar tokens de longitud <=2 y una lista corta de stopwords en español.
   - Devolver también, por cada rol/provincia/ccaa/municipio detectado, el `matchedPhrase` original consumido, para que el chip borre exactamente ese texto en la caja del usuario.

2. **`src/routes/directorio.tsx`**
   - Cambiar `enabled` a `true` (siempre) y hacer que las ramas que dependen del índice de municipios se apliquen sólo cuando `municipalitiesQ.data` está cargado.
   - `chips` y `removeToken`: usar la nueva `matchedPhrase` en vez del nombre canónico.
   - Añadir un pequeño panel de depuración accesible (solo cuando `?debug=1`) que muestre `parsed` — útil para verificar sin volver a ciclos.

### Verificación

En build mode, con Playwright: `/directorio?q=guion`, `/directorio?q=granada`, `/directorio?q=guionista+andalucia`, `/directorio?q=director%20de%20fotografia`. Comprobar recuento y que el chip elimina el token escrito.

## 2) Mapa filtrado en `/directorio`

Reutilizar exactamente el componente `ProfessionalsLeafletMap` que ya usa la home (Península + inset de Canarias, coropletas de municipios <20k, clusters, popups). Se pinta encima de la rejilla de resultados y se alimenta de los MISMOS `enriched` que se muestran abajo, así el mapa siempre refleja el filtro activo.

### Cambios

1. **`src/routes/directorio.tsx`**
   - Añadir un `useMemo` que transforma `enriched` en `MapProfessional[]`:
     - Descarta filas sin `geo_lat` / `geo_lng`. Como el `select` actual no trae geo, ampliarlo con `geo_lat, geo_lng, geo_accuracy, geo_municipality_name, geo_province, verified` (columnas ya expuestas al rol `anon`).
   - Renderizar el mapa arriba del bloque de resultados en un contenedor con altura `min(50vh, 460px)`, colapsable con un botón "Ocultar mapa / Mostrar mapa" (estado local, por defecto abierto en desktop, cerrado en móvil vía `use-mobile`).
   - Si `enriched` está vacío tras aplicar filtros, mostrar el mapa base sin puntos (mismo componente, array vacío) con un rótulo "Sin profesionales para estos filtros".

2. **`ProfessionalsLeafletMap`**: sin cambios; ya acepta `professionals: MapProfessional[]` variable y limpia clusters en cada cambio (`useEffect` sobre `key`).

### Fuera de alcance

- No se toca la normalización de datos en BD.
- No se cambia la home ni el mapa `/mapa`.
- No se añade búsqueda fuzzy (Levenshtein) — sigue siendo match por sinónimos + tokens.

## Detalles técnicos

- Stopwords ES iniciales: `["de","la","el","los","las","y","o","en","del","al"]`.
- `matchedPhrase` se guarda en `ParsedQuery` como arrays paralelos: `roles: Array<{ canonical: string; phrase: string }>` (breaking en la firma; `directorio.tsx` es el único consumidor, se adapta).
- El mapa usa `verified = true` ya garantizado por el `.eq("verified", true)` existente.
