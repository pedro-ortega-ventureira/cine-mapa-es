# Catálogo editorial orientado a venta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir y publicar en staging una página de catálogo editorial que conduzca a la compra y presente las colecciones de Aulós en el orden aprobado.

**Architecture:** Un módulo puro genera el HTML/CSS a partir de datos comerciales recuperados de WooCommerce, sin duplicar precios, imágenes ni enlaces. Un publicador autenticado recupera primero el documento vigente de Elementor, crea o actualiza únicamente la página de catálogo en staging y verifica después el HTML renderizado.

**Tech Stack:** Node.js 22, `node:test`, WordPress, WooCommerce, Elementor, HTML y CSS responsive.

**Spec:** `docs/superpowers/specs/2026-10-03-catalogo-editorial-venta-design.md`

## Global Constraints

- Publicar únicamente en `staging8.aulos.es`; no escribir en `aulos.es`.
- No imprimir ni persistir credenciales fuera de `.env.aulos.local` y archivos temporales con permisos `600`.
- Recuperar la configuración vigente de Elementor inmediatamente antes de guardar.
- No modificar home, productos, categorías, precios, inventario, carrito ni checkout.
- Hero fijo del producto `6197`, con **Ver edición** y **Añadir al carrito** cuando el producto sea comprable.
- Orden exacto: Aulós Humanidades, Aulós Digital, Aulós Academics, Packs, Herejía y Belleza, Mistérica y Catálogos.
- Un único `h1`, contraste accesible, foco visible, controles de 44 px y `prefers-reduced-motion`.

## Review Focus

- Producto `6197` no comprable: conservar **Ver edición** y omitir **Añadir al carrito**.
- Colección inexistente o vacía: omitir el bloque sin inventar contenido ni alterar el orden restante.
- Producto sin autoría: renderizar la tarjeta sin línea vacía ni texto de relleno.
- Producto externo: enlazar a su ficha/modalidad real sin generar una acción interna de carrito falsa.
- Reejecución del publicador: actualizar la misma página sin crear duplicados ni sobrescribir cambios remotos no recuperados.

---

### Task 1: Modelo y renderizado del catálogo

**Files:**
- Create: `scripts/lib/aulos-sales-catalog.mjs`
- Create: `scripts/aulos-sales-catalog.test.mjs`

**Interfaces:**
- Consumes: productos y categorías normalizados de WooCommerce.
- Produces: `normalizeCatalogState(rawProducts, rawCategories)`, `selectCollectionProducts(state, orderedCollections, limit)`, `renderSalesCatalog(model)` y `buildHeroModel(product)`.

- [ ] **Step 1: Escribir pruebas fallidas del modelo y del hero**

Cubrir el orden exacto de las siete colecciones, producto `6197`, CTA de carrito condicionado por `purchasable`, producto externo, autoría ausente y colección vacía.

- [ ] **Step 2: Ejecutar las pruebas y comprobar el fallo esperado**

Run: `node --test scripts/aulos-sales-catalog.test.mjs`

Expected: FAIL porque `scripts/lib/aulos-sales-catalog.mjs` todavía no existe.

- [ ] **Step 3: Implementar las funciones puras de normalización y selección**

`selectCollectionProducts` conserva el orden aprobado y selecciona como máximo cuatro productos publicados y visibles por colección, con los más recientes primero.

- [ ] **Step 4: Implementar `renderSalesCatalog(model)`**

Generar un único bloque encapsulado bajo `.aulos-catalog`, con un `h1`, `h2` por colección, hero del producto `6197`, tarjetas comerciales y navegación de colecciones accesible.

- [ ] **Step 5: Añadir pruebas de contrato visual y accesibilidad**

Comprobar tokens `#F5F2EC`, `#171717`, burdeos, foco visible, área mínima de 44 px, `prefers-reduced-motion`, ausencia de título blanco sobre papel y orden responsive.

- [ ] **Step 6: Ejecutar las pruebas enfocadas**

Run: `node --test scripts/aulos-sales-catalog.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/aulos-sales-catalog.mjs scripts/aulos-sales-catalog.test.mjs
git commit -m "feat: build Aulos sales catalog"
```

### Task 2: Transporte de staging y publicación segura

**Files:**
- Create: `scripts/publish-aulos-sales-catalog.mjs`
- Modify: `scripts/aulos-sales-catalog.test.mjs`

**Interfaces:**
- Consumes: `.env.aulos.local`, generador de Task 1, sesión WordPress y estado vigente de Elementor.
- Produces: modos CLI `--dry-run`, `--apply` y `--verify`; `fetchPublishedCatalogState()`, `fetchCurrentElementorDocument(pageId)`, `publishCatalogPage(document, renderedCatalog)` y `verifyRenderedCatalog(url)`.

- [ ] **Step 1: Escribir pruebas fallidas de seguridad y publicación idempotente**

Probar host limitado a `staging8.aulos.es`, redacción de secretos, `--dry-run` sin escrituras, relectura previa de Elementor, actualización idempotente y parada ante cambios remotos inesperados.

- [ ] **Step 2: Ejecutar las pruebas y comprobar el fallo esperado**

Run: `node --test scripts/aulos-sales-catalog.test.mjs`

Expected: FAIL porque el publicador todavía no existe.

- [ ] **Step 3: Implementar autenticación y recuperación de estado**

Recuperar productos/categorías mediante las superficies disponibles de WooCommerce/WordPress y el documento Elementor vigente, sin registrar cookies, nonces ni credenciales.

- [ ] **Step 4: Implementar `--dry-run` y validación del manifiesto**

El resumen incluye IDs, slugs, colecciones y conteos; nunca credenciales, datos de clientes ni contenido de pedidos.

- [ ] **Step 5: Implementar publicación idempotente en `/catalogo`**

Crear la página si no existe o actualizar esa misma página si existe; guardar en borrador durante la construcción y publicar solo cuando el documento renderizado supere validaciones locales.

- [ ] **Step 6: Ejecutar las pruebas enfocadas**

Run: `node --test scripts/aulos-sales-catalog.test.mjs`

Expected: PASS.

- [ ] **Step 7: Ejecutar el dry run autenticado**

Run: `node scripts/publish-aulos-sales-catalog.mjs --dry-run`

Expected: producto `6197` encontrado, siete colecciones evaluadas, cero escrituras y URL objetivo de staging validada.

- [ ] **Step 8: Commit**

```bash
git add scripts/publish-aulos-sales-catalog.mjs scripts/aulos-sales-catalog.test.mjs
git commit -m "feat: add safe Aulos catalog publisher"
```

### Task 3: Publicación y verificación en staging

**Files:**
- Runtime only: archivos temporales de sesión y copias de configuración fuera de Git.

**Interfaces:**
- Consumes: publicador de Task 2 y configuración vigente recuperada inmediatamente antes de escribir.
- Produces: página publicada en `staging8.aulos.es/catalogo/` y resultado verificable de `--verify`.

- [ ] **Step 1: Recuperar de nuevo el documento vigente y aplicar la actualización**

Run: `node scripts/publish-aulos-sales-catalog.mjs --apply`

Expected: una única página `/catalogo/`, hero del producto `6197` y bloques solo para colecciones con productos publicados.

- [ ] **Step 2: Verificar estado renderizado y enlaces comerciales**

Run: `node scripts/publish-aulos-sales-catalog.mjs --verify`

Expected: HTTP correcto, un `h1`, orden de colecciones válido, CTA de producto real, enlaces de fichas válidos, ausencia de borradores y CSS editorial presente.

- [ ] **Step 3: Comprobar escritorio y móvil**

Verificar hero, tarjetas, navegación, foco, contraste, botones de 44 px y ausencia de desbordamiento horizontal en 1440 px, 768 px y 390 px.

- [ ] **Step 4: Ejecutar regresión completa**

Run: `npm test`

Expected: PASS sin fallos.

- [ ] **Step 5: Commit de ajustes de verificación, si los hubiera**

No incluir cookies, nonces, copias de Elementor ni credenciales.
