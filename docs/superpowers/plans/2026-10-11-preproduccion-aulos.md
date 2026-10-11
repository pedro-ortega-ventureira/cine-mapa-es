# Aulós Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar staging semánticamente consistente, con un catálogo canónico, un informe SEO verificable y cabeceras de seguridad listas para la decisión final de producción.

**Architecture:** Un auditor Node autenticado recopilará evidencia sin secretos. Un publicador con control de versión corregirá solo los documentos Elementor o componentes globales identificados, y un plugin WordPress reversible gestionará la redirección y las cabeceras.

**Tech Stack:** Node.js 22, `node:test`, WordPress REST API, Elementor, PHP 7.4+, WooCommerce y HTTP.

**Spec:** `docs/superpowers/specs/2026-10-11-preproduccion-aulos-design.md`

## Global Constraints

- Escribir solo en `staging8.aulos.es`; nunca en `aulos.es` sin autorización explícita.
- Recuperar la versión vigente antes de cada escritura y cancelar ante cambios concurrentes.
- No imprimir ni persistir credenciales, cookies o nonces.
- No realizar una compra de prueba.
- No modificar copy SEO sin aprobación adicional.

## Review Focus

- Cabeceras duplicadas por variantes responsive: contar el contenido efectivo sin ocultar un segundo `H1` en el DOM.
- Redirecciones demasiado amplias: limitar la regla exactamente a `/shop/` y conservar queries.
- CSP incompatible con Elementor/WooCommerce: inventariar orígenes reales y validar en Report-Only antes de aplicar.
- Canonicals inconsistentes tras redirigir: exigir `/catalogo/` como destino 200 y canonical propio.
- Caché de WordPress/CDN: verificar con peticiones independientes y cache-busting después de publicar.

---

### Task 1: Auditor SEO y semántico reproducible

**Files:**
- Create: `scripts/lib/aulos-production-audit.mjs`
- Create: `scripts/aulos-production-audit.test.mjs`
- Create: `scripts/audit-aulos-production-readiness.mjs`
- Create: `docs/auditoria-preproduccion-aulos.md`

**Interfaces:**
- Produces: `auditPage(html, headers, url)` y un informe sin secretos para home, catálogo, zine, publica, producto, carrito, cuenta y legales.

- [ ] Escribir pruebas fallidas para título, metadescripción, canonical, niveles de encabezado, múltiples `H1`, estado HTTP y cabeceras.
- [ ] Ejecutar `node --test scripts/aulos-production-audit.test.mjs` y confirmar el fallo esperado.
- [ ] Implementar el analizador y el CLI autenticado, limitado al host de staging.
- [ ] Ejecutar el auditor, generar `docs/auditoria-preproduccion-aulos.md` y clasificar hallazgos en bloqueantes y recomendaciones.
- [ ] Repetir las pruebas y confirmar que no aparece ningún secreto en el informe.

### Task 2: Jerarquía de encabezados

**Files:**
- Create: `scripts/lib/aulos-heading-repair.mjs`
- Create: `scripts/aulos-heading-repair.test.mjs`
- Create: `scripts/publish-aulos-heading-repair.mjs`
- Modify: solo los documentos Elementor o componentes globales que Task 1 identifique.

**Interfaces:**
- Consumes: hallazgos `headings` de Task 1.
- Produces: `planHeadingRepairs(audit)` y modos `--inspect`, `--apply`, `--verify`.

- [ ] Escribir pruebas fallidas que conserven el `H1` editorial y degraden solo duplicados globales a elementos neutros o `H2` apropiados.
- [ ] Ejecutar las pruebas y confirmar que fallan por ausencia de la transformación.
- [ ] Implementar transformaciones idempotentes y guardado con hash de versión.
- [ ] Inspeccionar el plan remoto; exigir exactamente una reparación por duplicado detectado.
- [ ] Aplicar en staging y volver a auditar todas las URLs hasta obtener un `H1` de contenido por página indexable.

### Task 3: Catálogo canónico y cabeceras de seguridad

**Files:**
- Create: `wordpress-plugin/aulos-production-readiness/aulos-production-readiness.php`
- Create: `wordpress-plugin/aulos-production-readiness/tests/plugin-contract.test.mjs`
- Create: `wordpress-plugin/aulos-production-readiness/README.md`

**Interfaces:**
- Produces: redirección exacta `/shop/` → `/catalogo/`; filtros de cabeceras configurables entre `report-only` y `enforce`.

- [ ] Escribir contratos fallidos para 301 exacto, conservación de query, exclusión de producto/carrito/cuenta y presencia de las cuatro familias de cabeceras.
- [ ] Ejecutar las pruebas y confirmar los fallos esperados.
- [ ] Implementar la redirección y `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`/`frame-ancestors` y CSP Report-Only.
- [ ] Empaquetar e instalar el plugin solo en staging, comprobando antes el estado vigente de plugins.
- [ ] Inventariar recursos de home, catálogo, zine, producto, carrito y cuenta; ajustar la allowlist mínima.
- [ ] Pasar CSP a modo aplicado solo si las comprobaciones no detectan recursos requeridos fuera de la allowlist.

### Task 4: Verificación y recomendación de despliegue

**Files:**
- Modify: `docs/auditoria-preproduccion-aulos.md`

**Interfaces:**
- Consumes: auditor de Task 1 y staging modificado por Tasks 2–3.
- Produces: veredicto `APTO`, `APTO CON OBSERVACIONES` o `NO APTO` con evidencia por requisito.

- [ ] Ejecutar `npm test` y todos los contratos Node/PHP del repositorio.
- [ ] Ejecutar dos auditorías independientes con cache-busting y comparar resultados.
- [ ] Confirmar 301 de `/shop/`, 200 y canonical de `/catalogo/`, un `H1` por página y cabeceras esperadas.
- [ ] Revisar escritorio y móvil en las páginas clave, sin completar ninguna compra.
- [ ] Actualizar el informe con pendientes SEO de copy y emitir recomendación final sin desplegar a producción.
