# WooCommerce Catalog Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the 69 staging products to the approved editorial categories, statuses, and internal/external variation model without losing commercial data.

**Architecture:** A local Node.js migration tool reads the approved classified CSV, fetches fresh WooCommerce state through the authenticated REST API, validates and builds an explicit per-product operation manifest, saves a complete rollback snapshot, and applies operations sequentially. A second verification pass compares the resulting remote catalog with the manifest and checks representative rendered product pages.

**Tech Stack:** Node.js 22, WooCommerce REST API v3 with WordPress cookie authentication and REST nonce, CSV, Vitest, WordPress/WooCommerce staging.

**Spec:** `docs/superpowers/specs/2026-10-03-migracion-catalogo-woocommerce-design.md`

## Global Constraints

- Operate only on `staging8.aulos.es`; never write to `aulos.es` or production.
- Do not print, persist, or commit credentials from `.env.aulos.local`.
- Preserve all current external URLs exactly.
- Preserve internal price, SKU, stock, virtual/downloadable configuration, download files, and download limits when converting a simple product.
- Do not delete products or variations.
- Stop the migration after the first failed write.
- Product 2207, `París 1900 (digital)`, must be assigned to `Aulós Humanidades`.
- The UAM repository link must be an external `Digital` variation with button text `GRATIS`.
- External variation metadata keys are `wpcev_url` and `wpcev_text`.

## Review Focus

- A downloadable simple product with an Amazon link retains every download field after conversion and gains `Digital` plus `Amazon` variations.
- A physical simple product with an external link retains stock semantics in `Impreso`, including unmanaged stock versus a numeric quantity.
- An already-variable product does not duplicate an existing external variation and retains variation IDs where an in-place update is possible.
- An external-only product does not acquire a fabricated internal sale modality.
- A write failure stops later products and leaves a precise list of already-applied IDs for rollback.

---

### Task 1: Parse and validate the approved migration input

**Files:**
- Create: `scripts/lib/aulos-catalog-migration.mjs`
- Create: `scripts/aulos-catalog-migration.test.mjs`
- Modify: `scripts/classify-aulos-product-links.mjs`

**Interfaces:**
- Consumes: semicolon-separated UTF-8 CSV and fresh WooCommerce product/category/variation objects.
- Produces: `parseCatalogCsv(text)`, `classifyExternalUrl(url)`, `validateCatalogInput(rows, remoteProducts)`, and `buildMigrationManifest(rows, remoteState)`.

- [ ] **Step 1: Write failing parser and validation tests**

Cover 69 unique IDs, quoted semicolon CSV, UTF-8 accents, Amazon and `amzn.to`, Jot Down, UAM, unsupported domains, missing remote IDs, duplicate IDs, blank external URLs, and the 2207 category override.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npx vitest run scripts/aulos-catalog-migration.test.mjs`

Expected: FAIL because the migration library does not exist.

- [ ] **Step 3: Implement the pure parsing, classification, validation, and manifest functions**

The manifest must describe category creation, product field updates, simple-to-variable conversions, internal variation payloads, external variation payloads, and expected final state without performing network writes.

- [ ] **Step 4: Add Review Focus tests owned by input planning**

Test downloadable conversion, physical stock copying, external-only products, variation deduplication by attribute and URL, and the UAM `Digital`/`GRATIS` rule.

- [ ] **Step 5: Run the focused tests**

Run: `npx vitest run scripts/aulos-catalog-migration.test.mjs`

Expected: PASS with no network access.

- [ ] **Step 6: Commit the pure migration planner**

```bash
git add scripts/lib/aulos-catalog-migration.mjs scripts/aulos-catalog-migration.test.mjs scripts/classify-aulos-product-links.mjs
git commit -m "feat: plan Aulos catalog migration"
```

### Task 2: Add authenticated staging transport, backups, and dry run

**Files:**
- Create: `scripts/migrate-aulos-catalog.mjs`
- Modify: `scripts/aulos-catalog-migration.test.mjs`
- Create at runtime: `backups/aulos-catalog-<timestamp>/manifest.json`
- Create at runtime: `backups/aulos-catalog-<timestamp>/products.json`
- Create at runtime: `backups/aulos-catalog-<timestamp>/variations.json`
- Create at runtime: `backups/aulos-catalog-<timestamp>/categories.json`
- Create at runtime: `backups/aulos-catalog-<timestamp>/input.csv`

**Interfaces:**
- Consumes: `.env.aulos.local`, approved CSV, and the pure planner from Task 1.
- Produces: `WooCommerceClient`, `fetchCatalogSnapshot()`, `writeBackup(snapshot, input, manifest)`, and CLI modes `--dry-run`, `--apply`, `--verify`, and `--restore`.

- [ ] **Step 1: Write failing transport and safety tests with mocked HTTP**

Assert redaction of secrets, GET-only dry run, dated backup completeness, stop-on-first-write-failure, applied-ID journal, and rejection of any hostname other than `staging8.aulos.es`.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npx vitest run scripts/aulos-catalog-migration.test.mjs`

Expected: FAIL because the transport and CLI do not exist.

- [ ] **Step 3: Implement login, nonce extraction, REST transport, snapshot, and CLI safety gates**

Reuse browser-like headers required by the staging anti-bot filter. Never include credentials in URLs, logs, backup files, or thrown errors.

- [ ] **Step 4: Implement backup and restore payload generation**

Restoration must update existing entities and recreate missing variation state without deleting later unrelated data.

- [ ] **Step 5: Run the test suite**

Run: `npx vitest run scripts/aulos-catalog-migration.test.mjs`

Expected: PASS.

- [ ] **Step 6: Run a live read-only dry run and inspect its manifest**

Run: `node scripts/migrate-aulos-catalog.mjs --dry-run --input docs/plantilla-edicion-productos-aulos-v4-clasificada.csv`

Expected: 69 products validated, 36 links classified as 25 Amazon, 10 Jot Down, and 1 UAM; zero writes; 2207 targets `Aulós Humanidades`.

- [ ] **Step 7: Commit the transport and dry-run tooling**

```bash
git add scripts/migrate-aulos-catalog.mjs scripts/aulos-catalog-migration.test.mjs .gitignore
git commit -m "feat: add safe staging catalog migrator"
```

### Task 3: Execute the staging migration

**Files:**
- Runtime data only: `backups/aulos-catalog-<timestamp>/`

**Interfaces:**
- Consumes: approved dry-run manifest and fresh pre-write snapshot.
- Produces: updated WooCommerce staging catalog and append-only applied-ID journal.

- [ ] **Step 1: Fetch a fresh snapshot immediately before writing**

Run the tool in `--apply` mode; it must re-fetch and compare the remote modification dates and relevant fields with the dry-run snapshot before the first write.

- [ ] **Step 2: Create missing product categories**

Resolve category names to IDs and record any created IDs in the journal.

- [ ] **Step 3: Apply products sequentially**

For each product: update category and status, convert type if required, create or update the internal variation, then create or update the external variation. Journal the ID only after its expected state is re-read successfully.

- [ ] **Step 4: Stop and restore affected products if any write or immediate re-read fails**

Run: `node scripts/migrate-aulos-catalog.mjs --restore --backup <backup-directory> --ids <applied-ids>`

Expected: restored IDs match the backup; no later IDs were touched.

- [ ] **Step 5: Record the completed migration summary**

The summary contains counts and IDs only, with no secrets or customer/order data.

### Task 4: Verify database state and rendered storefront behavior

**Files:**
- Create at runtime: `backups/aulos-catalog-<timestamp>/verification.json`

**Interfaces:**
- Consumes: final WooCommerce REST state and representative rendered product pages.
- Produces: machine-readable verification results and a human-readable summary.

- [ ] **Step 1: Run full API verification**

Run: `node scripts/migrate-aulos-catalog.mjs --verify --input docs/plantilla-edicion-productos-aulos-v4-clasificada.csv --backup <backup-directory>`

Expected: all 69 IDs pass status/category checks; all URLs and button texts match; 2207 is in `Aulós Humanidades`; internal commercial fields match the pre-write backup.

- [ ] **Step 2: Verify representative storefront pages**

Open one published product containing each of `Impreso`, `Digital`, `Amazon`, `Jot Down`, and the UAM `GRATIS` case. Confirm option labels, purchase behavior for internal variations, and final destination for external buttons.

- [ ] **Step 3: Verify unaffected products remained structurally unchanged**

Compare products without external URLs against the backup, allowing only the approved status and category changes.

- [ ] **Step 4: Run project regression checks**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit migration tooling verification adjustments, if any**

Do not commit backup data or credentials.

```bash
git add scripts/migrate-aulos-catalog.mjs scripts/aulos-catalog-migration.test.mjs
git commit -m "test: verify Aulos catalog migration"
```
