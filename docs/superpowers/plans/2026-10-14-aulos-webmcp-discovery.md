# Aulós WebMCP Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose Aulós's public Zine and catalogue through three safe WebMCP discovery tools that direct visitors to free content and paid book pages without performing commerce actions.

**Architecture:** A standalone WordPress/WooCommerce plugin normalizes published posts, categories, products and product categories behind read-only same-origin REST routes. A small browser asset detects `document.modelContext` and registers three imperative WebMCP tools; the reading-route handler calls the server-side recommender so matching remains factual and bounded.

**Tech Stack:** WordPress 6.0+, PHP 7.4+, WooCommerce, WordPress REST API, vanilla browser JavaScript, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-14-aulos-webmcp-discovery-design.md`

## Global Constraints

- Create the plugin at `wordpress-plugin/aulos-webmcp-discovery/`; use the text domain `aulos-webmcp-discovery`.
- Require WordPress 6.0, PHP 7.4 and active WooCommerce; show an administrator-only notice when WooCommerce is unavailable.
- Register exactly `explorar_contenidos`, `buscar_ediciones` and `recomendar_ruta_de_lectura` only when `document.modelContext.registerTool` exists.
- Keep every REST route read-only and same-origin; accept no credentials, user data, nonces or write operations.
- Trim text inputs to 160 characters; clamp `maximo_resultados` to 1–6 with a default of 3.
- Return only published public content and product fields visible to ordinary visitors; omit unknown price, availability, author, format, collection and category values rather than inferring them.
- Return canonical internal HTTPS URLs, a 280-character maximum summary, and explicit `acceso` values of `gratuito` or `pago`.
- The recommender puts free content first and includes at most two products only when normalized query terms overlap public product/category/collection data.
- Never add to cart, start checkout, apply coupons, authenticate a user or change existing pages' visual content.
- Install, test and verify only on `staging8.aulos.es`; production requires separate explicit authorization.

## Review Focus

- Empty, whitespace-only and over-160-character queries return a safe empty result or bounded normalized query without PHP notices; covered in Task 2.
- A product with no price, availability, author or format does not expose a fabricated or empty-value field; covered in Task 3.
- A query that matches an article but no product still returns a free-only route and no sales claim; covered in Task 4.
- A browser without WebMCP support never fetches data or emits a console error; covered in Task 5.
- Private, draft, password-protected, customer and order records cannot appear in any REST response; covered in Tasks 2 and 3.

---

## File Structure

- `wordpress-plugin/aulos-webmcp-discovery/aulos-webmcp-discovery.php`: plugin metadata, dependency guard and bootstrap.
- `wordpress-plugin/aulos-webmcp-discovery/includes/class-aulos-webmcp-input.php`: input cleaning, limit clamping and tokenization.
- `wordpress-plugin/aulos-webmcp-discovery/includes/class-aulos-webmcp-content-repository.php`: public Zine query and normalized article/category records.
- `wordpress-plugin/aulos-webmcp-discovery/includes/class-aulos-webmcp-edition-repository.php`: public WooCommerce query and normalized product/collection records.
- `wordpress-plugin/aulos-webmcp-discovery/includes/class-aulos-webmcp-route-builder.php`: deterministic free-first reading-route assembly.
- `wordpress-plugin/aulos-webmcp-discovery/includes/class-aulos-webmcp-rest-controller.php`: three read-only REST callbacks and response schemas.
- `wordpress-plugin/aulos-webmcp-discovery/includes/class-aulos-webmcp-presentation.php`: public script enqueueing and localized route URLs.
- `wordpress-plugin/aulos-webmcp-discovery/assets/aulos-webmcp.js`: capability check and imperative tool registration.
- `wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`: source-level contract and safety tests, following existing WordPress plugin test conventions.
- `wordpress-plugin/aulos-webmcp-discovery/README.md`: installation, Chrome origin-trial test procedure, tool examples and rollback.

### Task 1: Plugin bootstrap and public asset boundary

**Files:**
- Create: `wordpress-plugin/aulos-webmcp-discovery/aulos-webmcp-discovery.php`
- Create: `wordpress-plugin/aulos-webmcp-discovery/includes/class-aulos-webmcp-presentation.php`
- Create: `wordpress-plugin/aulos-webmcp-discovery/assets/aulos-webmcp.js`
- Create: `wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

**Interfaces:**
- Produces: `aulos_webmcp_discovery_bootstrap(): void` and `Aulos_WebMCP_Presentation::enqueue_assets(): void`.
- Consumes: no project-local interface; later tasks add loaded classes to the bootstrap.

- [ ] **Step 1: Write failing bootstrap contract tests**

Add Node tests asserting plugin metadata (Aulós WebMCP Discovery, WordPress 6.0, PHP 7.4, WooCommerce), the WooCommerce admin notice, the `plugins_loaded` bootstrap, `wp_enqueue_scripts` hook, and the asset's `document.modelContext` capability guard.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

Expected: FAIL because the plugin files do not exist.

- [ ] **Step 3: Implement the bootstrap and `Aulos_WebMCP_Presentation::enqueue_assets(): void`**

Load public-only dependencies after WooCommerce is available. Enqueue `assets/aulos-webmcp.js` in the footer only outside wp-admin, localizing the REST root and route names without credentials, page content or analytics identifiers. Start the JavaScript with a capability guard that returns before registering or fetching anything when WebMCP is missing.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add wordpress-plugin/aulos-webmcp-discovery
git commit -m "feat: bootstrap Aulos WebMCP discovery plugin"
```

### Task 2: Public Zine repository and content REST route

**Files:**
- Create: `wordpress-plugin/aulos-webmcp-discovery/includes/class-aulos-webmcp-input.php`
- Create: `wordpress-plugin/aulos-webmcp-discovery/includes/class-aulos-webmcp-content-repository.php`
- Create: `wordpress-plugin/aulos-webmcp-discovery/includes/class-aulos-webmcp-rest-controller.php`
- Modify: `wordpress-plugin/aulos-webmcp-discovery/aulos-webmcp-discovery.php`
- Modify: `wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

**Interfaces:**
- Produces: `Aulos_WebMCP_Input::text( $value ): string`, `Aulos_WebMCP_Input::limit( $value ): int`, `Aulos_WebMCP_Input::tokens( string $text ): array`, and `Aulos_WebMCP_Content_Repository::search( string $query, string $category, int $limit ): array`.
- Produces: `GET /wp-json/aulos-webmcp/v1/content` handled by `Aulos_WebMCP_REST_Controller::get_content( WP_REST_Request $request ): WP_REST_Response`.
- Consumed by Task 4: normalized article records with `tipo`, `acceso`, `titulo`, `resumen`, `categoria` and `url`.

- [ ] **Step 1: Write failing content-route contract tests**

Assert input cleaning with `sanitize_text_field`, truncation to 160 characters, and a 1–6 limit with default 3. Assert the content repository queries post status `publish`, excludes password-protected posts, uses `get_permalink`, and returns `tipo => articulo`, `acceso => gratuito`, and a 280-character maximum summary. Assert the route is `GET` with a public `permission_callback`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

Expected: FAIL because the input, repository and route contracts are absent.

- [ ] **Step 3: Implement the input normalizer, content repository and route**

Use `WP_Query` only for public `post` records; filter by a validated category slug. Use character-safe trimming for summaries. Build URLs with `get_permalink` and reject a record unless its URL is internal HTTPS.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add wordpress-plugin/aulos-webmcp-discovery
git commit -m "feat: expose public Aulos Zine content"
```

### Task 3: WooCommerce edition repository and search route

**Files:**
- Create: `wordpress-plugin/aulos-webmcp-discovery/includes/class-aulos-webmcp-edition-repository.php`
- Modify: `wordpress-plugin/aulos-webmcp-discovery/includes/class-aulos-webmcp-rest-controller.php`
- Modify: `wordpress-plugin/aulos-webmcp-discovery/aulos-webmcp-discovery.php`
- Modify: `wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

**Interfaces:**
- Produces: `Aulos_WebMCP_Edition_Repository::search( string $query, string $collection, string $format, int $limit ): array`.
- Produces: `GET /wp-json/aulos-webmcp/v1/editions` handled by `Aulos_WebMCP_REST_Controller::get_editions( WP_REST_Request $request ): WP_REST_Response`.
- Consumed by Task 4: normalized product records with `tipo`, `acceso`, `titulo`, `resumen`, `coleccion`, `precio`, `disponibilidad` and `url_ficha` only when publicly available.

- [ ] **Step 1: Write failing edition-route contract tests**

Assert published WooCommerce product queries only, canonical product permalinks, `tipo => producto`, `acceso => pago`, validated product-category filtering, and conditional price, stock availability, author and format. Add negative assertions for order, customer, cart, checkout and mutation APIs.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

Expected: FAIL because the edition repository and route are absent.

- [ ] **Step 3: Implement the edition repository and route**

Use WooCommerce public product APIs with `publish` visibility. Map public product categories to `coleccion`; read author and format only from configured public product attributes. Return current visible price and stock status only if non-empty. Do not assume that all products are purchasable or metadata exists.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add wordpress-plugin/aulos-webmcp-discovery
git commit -m "feat: expose public Aulos editions"
```

### Task 4: Deterministic free-first reading-route endpoint

**Files:**
- Create: `wordpress-plugin/aulos-webmcp-discovery/includes/class-aulos-webmcp-route-builder.php`
- Modify: `wordpress-plugin/aulos-webmcp-discovery/includes/class-aulos-webmcp-rest-controller.php`
- Modify: `wordpress-plugin/aulos-webmcp-discovery/aulos-webmcp-discovery.php`
- Modify: `wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

**Interfaces:**
- Consumes: Task 2 content search, Task 3 edition search, and `Aulos_WebMCP_Input::tokens(...)`.
- Produces: `Aulos_WebMCP_Route_Builder::build( string $question, string $interest, int $limit ): array`.
- Produces: `GET /wp-json/aulos-webmcp/v1/reading-route` handled by `Aulos_WebMCP_REST_Controller::get_reading_route( WP_REST_Request $request ): WP_REST_Response`.

- [ ] **Step 1: Write failing recommendation contract tests**

Assert free records precede paid records, paid records are limited to two, matching uses normalized public tokens, and no-overlap queries omit products. Assert route responses never include cart, checkout, coupon, account or order URLs.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

Expected: FAIL because the route builder and route are absent.

- [ ] **Step 3: Implement the route builder and callback**

Retrieve up to six candidate articles and editions, tokenize public titles, summaries, categories and collections, then retain only editions sharing query/interest tokens. Return articles first and no more than two retained editions. Set `motivo` from the shared public token/category/collection; if there is no match, return an empty route with neutral text.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add wordpress-plugin/aulos-webmcp-discovery
git commit -m "feat: add factual Aulos reading routes"
```

### Task 5: Register the three WebMCP tools

**Files:**
- Modify: `wordpress-plugin/aulos-webmcp-discovery/assets/aulos-webmcp.js`
- Modify: `wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

**Interfaces:**
- Consumes: localized endpoints from Task 1 and the three `GET` schemas from Tasks 2–4.
- Produces: browser registrations named `explorar_contenidos`, `buscar_ediciones` and `recomendar_ruta_de_lectura`.

- [ ] **Step 1: Write failing WebMCP contract tests**

Assert exactly the three approved names, descriptions distinguishing free content from paid editions, JSON input schemas with approved fields and limits, same-origin `GET` fetches, and early return when WebMCP is unavailable. Assert no cart, checkout, account, coupon, order or credential strings appear in the asset.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

Expected: FAIL because tool registration is incomplete.

- [ ] **Step 3: Implement imperative `registerTool` handlers**

Register one handler per REST route. Validate client input, URL-encode query parameters, convert non-OK responses to safe textual tool errors, and map successful JSON to concise structured output with canonical links. Do not fetch or mutate at module load time.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add wordpress-plugin/aulos-webmcp-discovery
git commit -m "feat: register Aulos WebMCP discovery tools"
```

### Task 6: Package documentation and staging verification

**Files:**
- Create: `wordpress-plugin/aulos-webmcp-discovery/README.md`
- Modify: `wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

**Interfaces:**
- Consumes: complete plugin from Tasks 1–5.
- Produces: reproducible staging installation, validation and rollback instructions.

- [ ] **Step 1: Write a failing release-safety contract test**

Assert that no plugin PHP or JavaScript source contains a staging hostname, password, cookie value, authorization header, cart mutation hook or direct checkout API call. Assert the README names staging-only deployment and deactivation as rollback.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

Expected: FAIL because the README and final safety constraints are absent.

- [ ] **Step 3: Write the README and package the plugin directory**

Document: zip only this directory; recover current staging plugin state before upload; install through authenticated WordPress plugin administration; activate only after confirmation; use Chrome's WebMCP testing flag/origin-trial configuration; inspect the three tools in DevTools; deactivate to roll back. Do not put credentials, staging URLs or production instructions in the distributed files.

- [ ] **Step 4: Run all plugin contract tests**

Run: `node --test wordpress-plugin/aulos-webmcp-discovery/tests/plugin-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Verify in staging without production publication**

Recover the live staging plugin configuration, upload only the packaged ZIP through the authenticated WordPress installer, activate after confirmation, and inspect home, Zine, catalogue, one product and cart with and without WebMCP enabled. Verify exactly three tools, free-first results, no more than two paid results, non-mutating invalid-input errors, no console errors and no cart change. Record only non-secret evidence.

- [ ] **Step 6: Commit**

```bash
git add wordpress-plugin/aulos-webmcp-discovery
git commit -m "docs: verify Aulos WebMCP discovery plugin"
```

## Plan Self-Review

- **Spec coverage:** Tasks 1–5 cover the plugin, three tools, public data, free-first routing, capability fallback and security; Task 6 covers package and staging verification.
- **Type consistency:** repositories (Tasks 2–3) feed the route builder (Task 4), whose three response shapes feed the browser registrations (Task 5).
- **Review focus:** each high-risk input or failure mode is assigned to tests in its owning task.
- **Scope:** no task introduces an LLM, personalization, write operation, production release or visual page change.
