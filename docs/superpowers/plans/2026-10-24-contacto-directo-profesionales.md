# Contacto directo con profesionales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar cada contacto al correo privado del profesional seleccionado y rechazar el envío si ese perfil no tiene un destinatario válido.

**Architecture:** La consulta privilegiada del servidor ampliará `ContactProfessional` con `email`. El servicio validará ese valor antes de reservar el contacto y construirá el payload persistido con dicho destinatario; la configuración de entorno conservará solo la API key y el remitente.

**Tech Stack:** TypeScript, TanStack Start server functions, Supabase, Resend, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-contacto-directo-profesionales-design.md`

## Global Constraints

- El correo del profesional solo puede consultarse y utilizarse en código de servidor.
- `CONTACT_EMAIL_FROM` sigue siendo obligatorio; `CONTACT_EMAIL_TO` deja de serlo.
- Un perfil sin correo válido devuelve exactamente «Este profesional no puede recibir mensajes» y no reserva ni envía nada.
- Se conservan idempotencia, límite de envíos, payload persistido y `Reply-To` actuales.
- No modificar ni incluir en commits los cambios Aulós presentes en el árbol de trabajo.

## Review Focus

- Correo `null`, vacío o compuesto por espacios: rechazo antes de reservar.
- Cadena con forma inválida: rechazo antes de reservar.
- Correo válido rodeado de espacios: normalización y envío a la dirección limpia.
- Perfil inexistente o no verificado: conserva el error de disponibilidad actual.
- Reintento de una reserva existente: utiliza byte por byte el payload y destinatario persistidos.

---

### Task 1: Destinatario del perfil en el servicio de contacto

**Files:**
- Modify: `src/lib/contact-message-service.ts`
- Modify: `src/lib/contact-message-service.test.ts`
- Modify: `src/lib/contact-message.ts`
- Modify: `src/lib/contact-message.test.ts`

**Interfaces:**
- Consumes: `buildContactEmail(input, professionalName, config, submittedAt)` y `ContactProfessional`.
- Produces: `ContactProfessional.email: string | null`; payload con `to` igual al correo normalizado del profesional.

- [ ] **Step 1: Escribir pruebas fallidas del destinatario**

Añadir pruebas que exijan envío a `professional.email.trim()`, rechazo exacto para `null`, espacios y formato inválido, ausencia de reserva/envío en esos rechazos, y reutilización del destinatario persistido en reintentos.

- [ ] **Step 2: Ejecutar las pruebas y confirmar RED**

Run: `npm test -- src/lib/contact-message-service.test.ts src/lib/contact-message.test.ts`
Expected: FAIL porque el servicio aún usa `emailConfig.to` y `ContactProfessional` no contiene `email`.

- [ ] **Step 3: Implementar la validación y construcción del payload**

Cambiar `ContactEmailConfig` para conservar solo `from`; ampliar `ContactProfessional` con `email`; validar y normalizar el destinatario en `deliverContactMessage` antes de `reserve`; pasar el destinatario validado a `buildContactEmail` sin exponerlo fuera del servidor.

- [ ] **Step 4: Ejecutar las pruebas y confirmar GREEN**

Run: `npm test -- src/lib/contact-message-service.test.ts src/lib/contact-message.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contact-message.ts src/lib/contact-message.test.ts src/lib/contact-message-service.ts src/lib/contact-message-service.test.ts
git commit -m "feat: route contacts to each professional"
```

### Task 2: Consulta privada y configuración de servidor

**Files:**
- Modify: `src/lib/contact-message.server.ts`
- Modify: `src/lib/contact-message.server.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `ContactProfessional.email` y `ContactEmailConfig.from` de Task 1.
- Produces: `getProfessional()` selecciona `id,full_name,verified,email`; `readContactEmailConfig()` requiere únicamente `RESEND_API_KEY` y `CONTACT_EMAIL_FROM`.

- [ ] **Step 1: Escribir pruebas fallidas de repositorio y entorno**

Exigir que la consulta incluya `email`, que lo mapee sin publicarlo al cliente, que la configuración funcione sin `CONTACT_EMAIL_TO` y que siga fallando si faltan la API key o el remitente.

- [ ] **Step 2: Ejecutar las pruebas y confirmar RED**

Run: `npm test -- src/lib/contact-message.server.test.ts`
Expected: FAIL por la selección y configuración actuales.

- [ ] **Step 3: Implementar consulta y configuración mínimas**

Seleccionar y mapear `email` en el repositorio privilegiado, eliminar la lectura de `CONTACT_EMAIL_TO` y retirarla de `.env.example`.

- [ ] **Step 4: Ejecutar las pruebas y confirmar GREEN**

Run: `npm test -- src/lib/contact-message.server.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contact-message.server.ts src/lib/contact-message.server.test.ts .env.example
git commit -m "chore: remove fixed contact recipient"
```

### Task 3: Verificación integral y documentación

**Files:**
- Modify: `docs/superpowers/specs/2026-10-24-contacto-directo-profesionales-design.md`
- Modify: `docs/superpowers/plans/2026-10-24-contacto-directo-profesionales.md`

**Interfaces:**
- Consumes: comportamiento completo de Tasks 1 y 2.
- Produces: cambio listo para revisión, sin alteraciones Aulós incluidas.

- [ ] **Step 1: Ejecutar toda la suite**

Run: `npm test -- --maxWorkers=4`
Expected: todas las pruebas PASS.

- [ ] **Step 2: Compilar producción**

Run: `npm run build -- --logLevel error`
Expected: exit 0.

- [ ] **Step 3: Revisar integridad y alcance**

Run: `git diff --check && git status --short`
Expected: sin errores de whitespace; solo se preparan archivos del contacto y sus documentos.

- [ ] **Step 4: Commit de documentación**

```bash
git add docs/superpowers/specs/2026-10-24-contacto-directo-profesionales-design.md docs/superpowers/plans/2026-10-24-contacto-directo-profesionales.md
git commit -m "docs: describe direct professional contact delivery"
```
