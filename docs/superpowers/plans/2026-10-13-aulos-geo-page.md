# Aulós GEO landing page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the staging-only `/por-que-aulos/` landing page so comparative discovery queries lead to verifiable Aulós catalogue and product pages.

**Architecture:** A small pure renderer supplies the approved HTML and validates the four required Store API products before the publisher writes a full-width Elementor HTML widget. The existing production-readiness plugin supplies the page-level SEO metadata, while the publisher and audit tooling enforce a staging-only, fetch-before-save, render-after-save workflow.

**Tech Stack:** Node.js ESM, native `fetch`, WordPress REST/AJAX, WooCommerce Store API, Elementor, PHP WordPress plugin, Node test runner, Playwright audit checks.

**Spec:** `docs/superpowers/specs/2026-10-13-aulos-geo-page-design.md`

## Global Constraints

- Phase one may write only to `https://staging8.aulos.es`; production requires a later explicit order.
- Read `.env.aulos.local` only at runtime; never print, commit, or copy credentials.
- Fetch the live Elementor document immediately before saving, cancel on a changed hash, and verify the rendered page afterwards.
- Page URL is `/por-que-aulos/`, uses one H1, and its content must not name competitors.
- Preserve the approved four product titles, including `La conquista de Portugal. Historia e iconografía` as the fourth entry.
- SEO values are exact: title `Por qué elegir Aulós | Libros de arte y humanidades`; description `Descubre el criterio editorial de Aulós y encuentra libros singulares de arte, estética, cine, ocultura y humanidades.`; canonical self; `index,follow`.
- Do not emit `Product` or `Offer` schema on this landing page; product pages retain commerce markup.
- Internal page links carry no UTM parameters; claims must be demonstrable from linked Aulós pages.

## Review Focus

- A renamed or unpublished featured product must stop publication instead of producing a guessed permalink (Task 1: `selectRequiredProducts` missing-title test).
- A URL other than the exact staging host must be rejected before any request (Task 2: `validateStagingUrl` production-host test).
- A remote Elementor edit between inspection and save must abort without overwriting it (Task 2: hash-mismatch test).
- An existing page must retain a single full-width Elementor container rather than accumulate duplicate content (Task 2: action-shape test).
- SEO must survive rendered HTTP output, not just the PHP mapping (Task 4: post-publish rendered-meta assertions).

### Task 1: GEO copy renderer and featured-product selection

**Files:**
- Create: `scripts/lib/aulos-geo-page.mjs`
- Create: `scripts/aulos-geo-page.test.mjs`

**Interfaces:**
- Consumes: WooCommerce Store API product records with `name`, `permalink`, and `status` fields.
- Produces: `REQUIRED_PRODUCT_TITLES: readonly string[]`, `selectRequiredProducts(products: object[]): object[]`, and `renderAulosGeoPage(products: object[]): string`.

- [ ] **Step 1: Write failing renderer tests**

  Add tests that require `selectRequiredProducts` to return the four titles in this exact order and throw when `La conquista de Portugal. Historia e iconografía` is absent. Require `renderAulosGeoPage` to contain exactly one `<h1>`, the approved hero and section headings, `/catalogo/`, no `utm_`, no named-competitor placeholder, and every selected product permalink.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `node --test scripts/aulos-geo-page.test.mjs`

  Expected: FAIL because the GEO renderer module does not exist.

- [ ] **Step 3: Implement the pure renderer and selector**

  Implement `selectRequiredProducts(products)` in `scripts/lib/aulos-geo-page.mjs` as case- and whitespace-stable matching against `REQUIRED_PRODUCT_TITLES`, rejecting missing, unpublished, or non-internal product links. Implement `renderAulosGeoPage(products)` with the approved paper/granate/serif visual system, one H1 (`Libros que piden otra forma de leer`), three criteria, three catalogue routes, the four product doors, and the closing catalogue CTA.

- [ ] **Step 4: Run the renderer tests and verify they pass**

  Run: `node --test scripts/aulos-geo-page.test.mjs`

  Expected: PASS.

- [ ] **Step 5: Commit the renderer deliverable**

  Run: `git add scripts/lib/aulos-geo-page.mjs scripts/aulos-geo-page.test.mjs && git commit -m "feat: render Aulos GEO landing page"`

### Task 2: Staging-safe Elementor publisher

**Files:**
- Create: `scripts/publish-aulos-geo-page.mjs`
- Modify: `scripts/aulos-geo-page.test.mjs`

**Interfaces:**
- Consumes: `renderAulosGeoPage(products)` and `selectRequiredProducts(products)` from Task 1 plus the existing staging session patterns in `scripts/publish-aulos-sales-catalog.mjs`.
- Produces: `validateStagingUrl(value: string): URL`, `buildGeoElementorActions(html: string): object`, and CLI commands `--inspect`, `--apply`, and `--verify`.

- [ ] **Step 1: Extend tests for publication guards and Elementor structure**

  Add unit tests that reject `https://aulos.es/`, build one top-level full-width container with one HTML widget, and make `assertRemoteUnchanged` reject differing document hashes. Add a fixture test for a Store API response that proves the publisher requests the four selected records before composing HTML.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `node --test scripts/aulos-geo-page.test.mjs`

  Expected: FAIL because the publisher exports and Store API integration do not exist.

- [ ] **Step 3: Implement the staging-only publisher**

  Implement the publisher by adapting the authenticated WordPress/Elementor session in `scripts/publish-aulos-sales-catalog.mjs`: load `.env.aulos.local` with redacted errors, accept only `staging8.aulos.es`, look up or create the `por-que-aulos` page, load required Store API products, fetch/hash the current Elementor document immediately before save, and save a full-width, hidden-title Elementor document. `--verify` must retrieve the public page and validate 200, one H1, all expected product URLs, and no missing destination response.

- [ ] **Step 4: Run unit tests and non-mutating inspection**

  Run: `node --test scripts/aulos-geo-page.test.mjs && node scripts/publish-aulos-geo-page.mjs --inspect`

  Expected: tests PASS; inspection prints only non-sensitive page/product state and performs no write.

- [ ] **Step 5: Commit the publisher deliverable**

  Run: `git add scripts/publish-aulos-geo-page.mjs scripts/aulos-geo-page.test.mjs && git commit -m "feat: add staging publisher for Aulos GEO page"`

### Task 3: SEO metadata and readiness-plugin release

**Files:**
- Modify: `scripts/lib/aulos-production-readiness.mjs`
- Modify: `wordpress-plugin/aulos-production-readiness/aulos-production-readiness.php`
- Modify: `wordpress-plugin/aulos-production-readiness/tests/plugin-contract.test.mjs`
- Modify: `scripts/publish-aulos-production-readiness.mjs`
- Modify: `scripts/aulos-production-audit.test.mjs`

**Interfaces:**
- Consumes: `seoMetadata(pathname)` from `scripts/lib/aulos-production-readiness.mjs` and the PHP filter contract in the production-readiness plugin.
- Produces: matching JS and PHP metadata for `/por-que-aulos/`, plugin version `1.2.0`, and a publisher that verifies that version after replacement.

- [ ] **Step 1: Write failing metadata and plugin-contract tests**

  Add assertions that `seoMetadata('/por-que-aulos/')` returns the exact title and description, `index,follow`, and that the PHP plugin source contains the same route and values. Add a release test requiring the readiness publisher's expected replacement version to be `1.2.0`.

- [ ] **Step 2: Run focused SEO tests and verify they fail**

  Run: `node --test wordpress-plugin/aulos-production-readiness/tests/plugin-contract.test.mjs scripts/aulos-production-audit.test.mjs`

  Expected: FAIL because the GEO route and 1.2.0 release target are absent.

- [ ] **Step 3: Add the canonical GEO metadata and versioned release guard**

  Add the `/por-que-aulos/` mapping identically to the JavaScript and PHP metadata sources. Increment the plugin header to `1.2.0` and update its publisher's accepted/verified target version while retaining its staging authentication and secret redaction behavior.

- [ ] **Step 4: Run the focused SEO tests and verify they pass**

  Run: `node --test wordpress-plugin/aulos-production-readiness/tests/plugin-contract.test.mjs scripts/aulos-production-audit.test.mjs`

  Expected: PASS.

- [ ] **Step 5: Commit the metadata release**

  Run: `git add scripts/lib/aulos-production-readiness.mjs wordpress-plugin/aulos-production-readiness/aulos-production-readiness.php wordpress-plugin/aulos-production-readiness/tests/plugin-contract.test.mjs scripts/publish-aulos-production-readiness.mjs scripts/aulos-production-audit.test.mjs && git commit -m "feat: add SEO metadata for Aulos GEO page"`

### Task 4: Audit coverage and staging publication verification

**Files:**
- Modify: `scripts/audit-aulos-production-readiness.mjs`
- Modify: `scripts/aulos-production-audit.test.mjs`
- Modify: `docs/auditoria-preproduccion-aulos.md`

**Interfaces:**
- Consumes: the Task 2 publisher, the Task 3 plugin release, and `auditPage(url)` / report functions in the current readiness audit.
- Produces: a readiness audit that includes `/por-que-aulos/` and a dated staging evidence entry.

- [ ] **Step 1: Write the failing audit-route test**

  Add a test requiring the readiness audit target set to include `/por-que-aulos/` and requiring a compliant fixture to report its self-canonical URL, `index,follow`, the exact title/description, and no CSP error.

- [ ] **Step 2: Run the audit test and verify it fails**

  Run: `node --test scripts/aulos-production-audit.test.mjs`

  Expected: FAIL because the GEO route is not an audited target.

- [ ] **Step 3: Add the GEO route to readiness auditing**

  Extend the audit target list and expected SEO checks for `/por-que-aulos/`; preserve the existing production-readiness checks and ensure no audit command writes to production.

- [ ] **Step 4: Run local regression checks**

  Run: `node --test scripts/aulos-geo-page.test.mjs scripts/aulos-production-audit.test.mjs wordpress-plugin/aulos-production-readiness/tests/plugin-contract.test.mjs && git diff --check`

  Expected: all tests PASS and no whitespace errors.

- [ ] **Step 5: Publish and verify staging in dependency order**

  Run: `node scripts/publish-aulos-production-readiness.mjs --apply`, then `node scripts/publish-aulos-geo-page.mjs --apply`, then `node scripts/publish-aulos-geo-page.mjs --verify`, then `node scripts/audit-aulos-production-readiness.mjs --base-url https://staging8.aulos.es`.

  Expected: plugin reports `1.2.0`; page returns 200 with exactly one H1; each internal target returns 200; rendered metadata is canonical/self and `index,follow`; CSP remains enforced without console errors.

- [ ] **Step 6: Perform browser viewport verification and record evidence**

  Use Playwright against the authenticated staging page at 390 px and 1440 px: assert `scrollWidth <= innerWidth`, no console CSP errors, no named competitor text, four approved titles, and working catalogue/product navigation. Add only the resulting timestamp, commands, URLs, and pass/fail evidence to `docs/auditoria-preproduccion-aulos.md`; never add credentials or tokens.

- [ ] **Step 7: Commit audit coverage and evidence**

  Run: `git add scripts/audit-aulos-production-readiness.mjs scripts/aulos-production-audit.test.mjs docs/auditoria-preproduccion-aulos.md && git commit -m "test: audit Aulos GEO landing page readiness"`

## Final Verification

- [ ] Run `git status --short` and confirm only intentional GEO changes are included in the handoff; do not stage unrelated pre-existing worktree changes.
- [ ] Run the Task 4 regression command plus the staging publisher verification and readiness audit once more after all commits.
- [ ] Review the rendered staging URL at 390 px and 1440 px and report the staging URL, plugin version, audit result, any known limitation, and that production has not been changed.
