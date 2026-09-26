# Ficha para contratación audiovisual rural — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar las fichas profesionales con movilidad, transporte, redes y cinco producciones destacadas, y permitir filtrar el directorio por condiciones operativas de contratación.

**Architecture:** Una migración aditiva extiende `professionals` y `filmography_items`; funciones puras concentran validación y traducción de filtros; las operaciones de servidor autogestionadas resuelven siempre la propiedad desde la sesión. La edición de filmografía se separa del guardado principal porque necesita un perfil ya creado.

**Tech Stack:** TypeScript 5.8, React 19, TanStack Start/Router/Query, Supabase/Postgres, Zod, Vitest, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-26-ficha-contratacion-rural-design.md`

## Global Constraints

- Máximo de cinco producciones destacadas por profesional.
- Título, año y rol desempeñado son obligatorios en nuevas producciones autogestionadas.
- Las imágenes se aportan únicamente mediante URL; no se suben archivos.
- Los campos nuevos son aditivos y opcionales para conservar fichas existentes.
- Cada profesional solo puede modificar las producciones vinculadas a su propio `user_id` autenticado.
- Los valores de desplazamiento son `local`, `provincial`, `national` e `international`.
- La disponibilidad conserva `Disponible`, `No disponible` y `Bajo consulta`.
- No se reescribe historia publicada ni se fuerza el push de la rama conectada a Lovable.

## Review Focus

- URLs con protocolos distintos de HTTP/HTTPS deben rechazarse sin borrar el resto del formulario; se prueba en la Tarea 2.
- Una sexta producción, incluidas inserciones simultáneas, debe rechazarse; se prueba en las Tareas 1 y 3.
- Un usuario que envíe el ID de una producción ajena no puede modificarla ni borrarla; se prueba en la Tarea 3.
- Los filtros booleanos deben distinguir `false` de “sin filtro”; se prueba en la Tarea 4.
- Una ficha antigua con todos los campos nuevos a `null` debe seguir renderizando sin etiquetas vacías; se prueba en la Tarea 6.

---

### Task 1: Migración y tipos de datos

**Files:**
- Create: `supabase/migrations/20260926090000_professional_hiring_fields.sql`
- Modify: `src/integrations/supabase/types.ts`
- Test: `src/lib/hiring-profile.test.ts`

**Interfaces:**
- Produces: `TravelScope = "local" | "provincial" | "national" | "international"`; columnas `travel_scope`, `has_own_vehicle`, `has_cargo_vehicle`, `can_drive_van`; columnas de filmografía `countries`, `genre`, `external_url`.
- Produces: función Postgres/trigger que impide más de cinco filas de `filmography_items` por `professional_id`.

- [ ] **Step 1: Escribir la prueba fallida de valores de desplazamiento**

Crear `src/lib/hiring-profile.test.ts` con una prueba que importe `TRAVEL_SCOPES` desde `./hiring-profile` y espere literalmente `['local', 'provincial', 'national', 'international']`.

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `npm test -- src/lib/hiring-profile.test.ts`
Expected: FAIL porque `src/lib/hiring-profile.ts` todavía no existe.

- [ ] **Step 3: Crear la migración aditiva**

Añadir las cuatro columnas opcionales a `professionals`, las tres columnas opcionales a `filmography_items`, un `CHECK` para `travel_scope` y un trigger `BEFORE INSERT` que tome un bloqueo transaccional asesor por `professional_id` antes de contar y bloquee una sexta producción con un mensaje estable. No cambiar filas existentes ni imponer `NOT NULL` a columnas históricas.

- [ ] **Step 4: Actualizar los tipos Supabase**

Reflejar exactamente las nuevas columnas en `Row`, `Insert` y `Update` de ambas tablas. Crear `src/lib/hiring-profile.ts` y exportar `TRAVEL_SCOPES` y `TravelScope`.

- [ ] **Step 5: Ejecutar prueba, lint y comprobación SQL local**

Run: `npm test -- src/lib/hiring-profile.test.ts && npm run lint`
Expected: PASS y 0 incidencias. Revisar que la migración incluya el mensaje `Máximo de 5 producciones destacadas`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260926090000_professional_hiring_fields.sql src/integrations/supabase/types.ts src/lib/hiring-profile.ts src/lib/hiring-profile.test.ts
git commit -m "Añade datos de contratación y filmografía"
```

### Task 2: Validación y normalización del formulario

**Files:**
- Modify: `src/lib/hiring-profile.ts`
- Modify: `src/lib/hiring-profile.test.ts`
- Modify: `src/lib/public-registration.functions.ts`

**Interfaces:**
- Consumes: `TravelScope` de la Tarea 1.
- Produces: `SocialLinks`, `normalizeSocialLinks(input)`, `FilmographyInput`, `filmographyInputSchema` y campos nuevos en `publicProfessionalInputSchema`.

- [ ] **Step 1: Escribir pruebas fallidas de redes y producción**

Añadir pruebas con estos comportamientos: elimina redes vacías; conserva una URL HTTPS válida; rechaza `javascript:`; acepta una producción con título, año y rol; rechaza título vacío, año ausente o rol vacío; limita países a cadenas no vacías.

- [ ] **Step 2: Ejecutar las pruebas y confirmar fallos por exports ausentes**

Run: `npm test -- src/lib/hiring-profile.test.ts`
Expected: FAIL al importar `normalizeSocialLinks` o `filmographyInputSchema`.

- [ ] **Step 3: Implementar contratos puros**

En `src/lib/hiring-profile.ts`, definir las claves sociales permitidas (`instagram`, `tiktok`, `linkedin`, `facebook`, `x`, `vimeo`, `youtube`), validación URL HTTP/HTTPS y el esquema de filmografía con `title`, `year`, `type`, `role_in_production`, `countries`, `genre`, `external_url`, `poster_url` y `sort_order`.

- [ ] **Step 4: Ampliar el esquema del perfil**

En `publicProfessionalInputSchema`, admitir `social_links`, `travel_scope`, `has_own_vehicle`, `has_cargo_vehicle` y `can_drive_van`; normalizar redes antes de construir payloads de alta y actualización.

- [ ] **Step 5: Ejecutar las pruebas**

Run: `npm test -- src/lib/hiring-profile.test.ts src/lib/auth-flow.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/hiring-profile.ts src/lib/hiring-profile.test.ts src/lib/public-registration.functions.ts
git commit -m "Valida movilidad redes y producciones"
```

### Task 3: Operaciones seguras de filmografía propia

**Files:**
- Modify: `src/lib/public-registration.functions.ts`
- Create: `src/lib/filmography-ownership.ts`
- Create: `src/lib/filmography-ownership.test.ts`

**Interfaces:**
- Consumes: `FilmographyInput` y `filmographyInputSchema` de la Tarea 2.
- Produces: `getMyFilmography`, `upsertMyFilmographyItem`, `deleteMyFilmographyItem`, `reorderMyFilmography`; `ownsFilmographyItem(profileId, itemProfessionalId): boolean`.

- [ ] **Step 1: Escribir pruebas fallidas de propiedad y límite**

Probar que IDs de profesional iguales autorizan; distintos deniegan; una colección de cinco permite actualizar pero no insertar un sexto; el reordenado rechaza IDs que no pertenecen al perfil.

- [ ] **Step 2: Ejecutar las pruebas y confirmar el fallo**

Run: `npm test -- src/lib/filmography-ownership.test.ts`
Expected: FAIL porque el módulo no existe.

- [ ] **Step 3: Implementar helpers de autorización puros**

Crear `ownsFilmographyItem` y `validateFilmographyMutation` con resultados discriminados que las funciones de servidor puedan convertir en errores seguros.

- [ ] **Step 4: Implementar las cuatro funciones de servidor**

Cada función obtiene primero el profesional con `.eq('user_id', context.userId)`. Actualización, borrado y reordenado añaden `.eq('professional_id', professional.id)`. Inserción cuenta filas antes de escribir y deja el trigger como defensa concurrente. El listado ordena por `sort_order`, después `created_at`.

- [ ] **Step 5: Ejecutar pruebas relacionadas**

Run: `npm test -- src/lib/filmography-ownership.test.ts src/lib/hiring-profile.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/filmography-ownership.ts src/lib/filmography-ownership.test.ts src/lib/public-registration.functions.ts
git commit -m "Protege la filmografía autogestionada"
```

### Task 4: Contrato de filtros del directorio

**Files:**
- Create: `src/lib/directory-filters.ts`
- Create: `src/lib/directory-filters.test.ts`
- Modify: `src/routes/directorio.tsx`

**Interfaces:**
- Consumes: `TravelScope` de la Tarea 1.
- Produces: `DirectorySearch`, `directorySearchSchema`, `applyHiringFilters(query, search)`.

- [ ] **Step 1: Escribir pruebas fallidas del esquema de búsqueda**

Probar valores válidos de disponibilidad y desplazamiento; `remote=false` conservado como filtro; valores booleanos inválidos descartados; combinación de `availability`, `remote`, `willing`, `travel`, `vehicle`, `cargo` y `van` traducida a los siete `.eq()` esperados mediante un query recorder real de prueba.

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `npm test -- src/lib/directory-filters.test.ts`
Expected: FAIL porque el módulo no existe.

- [ ] **Step 3: Implementar esquema y aplicación de filtros**

Validar booleanos URL como `"true" | "false" | undefined`, no con coerción genérica. `applyHiringFilters` debe devolver el query encadenado sin ejecutar la consulta.

- [ ] **Step 4: Integrar el contrato en la ruta**

Sustituir el `searchSchema` local por `directorySearchSchema`, seleccionar las columnas nuevas y llamar `applyHiringFilters` antes de ejecutar. Añadir selectores de disponibilidad y desplazamiento y selectores triestado para remoto, viajar y transporte. Incluirlos en `hasAnyFilter`.

- [ ] **Step 5: Ejecutar pruebas y lint**

Run: `npm test -- src/lib/directory-filters.test.ts && npm run lint`
Expected: PASS y 0 incidencias.

- [ ] **Step 6: Commit**

```bash
git add src/lib/directory-filters.ts src/lib/directory-filters.test.ts src/routes/directorio.tsx
git commit -m "Añade filtros de contratación al directorio"
```

### Task 5: Edición de ficha, redes y filmografía

**Files:**
- Create: `src/components/FilmographyEditor.tsx`
- Modify: `src/routes/registro.tsx`
- Modify: `src/lib/hiring-profile.test.ts`

**Interfaces:**
- Consumes: funciones de servidor de la Tarea 3 y tipos de la Tarea 2.
- Produces: `FilmographyEditor({ profileExists }: { profileExists: boolean })` y estado ampliado del formulario de registro.

- [ ] **Step 1: Escribir pruebas fallidas de conversión fila/formulario**

Exportar a un módulo puro `rowToHiringFormFields(row)` y probar que valores nulos producen cadenas vacías/checkboxes sin marcar, mientras que redes y movilidad guardadas se restauran literalmente.

- [ ] **Step 2: Ejecutar las pruebas y confirmar el fallo**

Run: `npm test -- src/lib/hiring-profile.test.ts`
Expected: FAIL porque `rowToHiringFormFields` no existe.

- [ ] **Step 3: Ampliar el formulario del perfil**

Añadir movilidad y logística; renombrar “Web” a “Web o portfolio”; añadir las siete URLs sociales. Incluir los valores nuevos en `emptyForm`, conversión de fila y payload.

- [ ] **Step 4: Crear `FilmographyEditor`**

Mostrar hasta cinco tarjetas con título, año, tipo, rol, países separados por comas, género, URL externa y URL del cartel. Guardar cada tarjeta mediante `upsertMyFilmographyItem`, eliminar con confirmación y reordenar con controles subir/bajar que llamen `reorderMyFilmography`. Deshabilitar “Añadir producción” al llegar a cinco.

- [ ] **Step 5: Integrar el editor**

Mostrar un aviso y deshabilitar el editor antes del primer guardado del perfil; habilitarlo cuando `existing` exista. Invalidar la query `['my-filmography']` después de cada mutación y mostrar errores con `toast.error` sin limpiar borradores.

- [ ] **Step 6: Ejecutar suite focalizada y lint**

Run: `npm test -- src/lib/hiring-profile.test.ts src/lib/filmography-ownership.test.ts && npm run lint`
Expected: PASS y 0 incidencias.

- [ ] **Step 7: Commit**

```bash
git add src/components/FilmographyEditor.tsx src/routes/registro.tsx src/lib/hiring-profile.test.ts
git commit -m "Amplía la ficha y permite editar producciones"
```

### Task 6: Presentación pública de contratación y producciones

**Files:**
- Create: `src/lib/public-profile.ts`
- Create: `src/lib/public-profile.test.ts`
- Modify: `src/routes/profesionales.$slug.tsx`

**Interfaces:**
- Consumes: columnas y tipos de las Tareas 1 y 2.
- Produces: `publicHiringDetails(profile)` y presentación pública ampliada.

- [ ] **Step 1: Escribir pruebas fallidas de detalles visibles**

Probar que una ficha antigua con campos nulos devuelve una lista vacía; una ficha completa devuelve etiquetas españolas para disponibilidad, remoto, radio y transporte; enlaces sociales vacíos o no permitidos no aparecen.

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `npm test -- src/lib/public-profile.test.ts`
Expected: FAIL porque el módulo no existe.

- [ ] **Step 3: Implementar helper de presentación**

Crear `publicHiringDetails` como función pura que omita nulos y traduzca valores persistidos a etiquetas de interfaz.

- [ ] **Step 4: Ampliar la consulta y la ficha pública**

Seleccionar movilidad y redes en el perfil; cargar `filmography_items` ordenados y limitados a cinco; mostrar logística, enlaces sociales y tarjetas de producción. El cartel usa `poster_url`; el enlace principal usa `external_url` y conserva enlaces TMDb existentes como alternativa.

- [ ] **Step 5: Ejecutar pruebas y lint**

Run: `npm test -- src/lib/public-profile.test.ts && npm run lint`
Expected: PASS y 0 incidencias.

- [ ] **Step 6: Commit**

```bash
git add src/lib/public-profile.ts src/lib/public-profile.test.ts 'src/routes/profesionales.$slug.tsx'
git commit -m "Muestra contratación y producciones en la ficha"
```

### Task 7: Verificación integral y documentación

**Files:**
- Modify if needed: files touched by Tasks 1–6 only
- Verify: `docs/superpowers/specs/2026-09-26-ficha-contratacion-rural-design.md`

**Interfaces:**
- Consumes: todas las entregas anteriores.
- Produces: una rama verificable y lista para aplicar migración/desplegar.

- [ ] **Step 1: Ejecutar toda la suite**

Run: `npm test`
Expected: todos los archivos y pruebas PASS.

- [ ] **Step 2: Ejecutar calidad estática**

Run: `npm run lint && git diff --check`
Expected: 0 incidencias y sin errores de espacios.

- [ ] **Step 3: Compilar producción**

Run: `npm run build`
Expected: exit 0; documentar advertencias no bloqueantes si permanecen.

- [ ] **Step 4: Comprobar manualmente el flujo**

Con una cuenta de prueba: editar movilidad y redes; crear cinco producciones; confirmar rechazo de la sexta; comprobar ficha pública; combinar filtros positivos y negativos; confirmar que mapa y listado coinciden.

- [ ] **Step 5: Revisar compatibilidad**

Abrir una ficha histórica sin datos nuevos y confirmar que no muestra bloques vacíos ni errores. Abrir administración y confirmar que la filmografía previa sigue editable.

- [ ] **Step 6: Commit de ajustes finales**

```bash
git add src supabase/migrations/20260926090000_professional_hiring_fields.sql
git commit -m "Verifica ficha para contratación rural"
```

Si la verificación no exige ajustes, omitir este commit.
