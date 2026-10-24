# Resend Contact Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conservar cada contacto en Supabase y notificarlo de forma idempotente a `pedro.ortega@españalatente.org` mediante Resend desde el backend de Vercel.

**Architecture:** El cliente llamará a una `createServerFn` pública en lugar de insertar directamente en Supabase. La función validará la solicitud, usará un servicio de entrega con repositorio y proveedor inyectables, guardará el mensaje con un UUID estable y enviará el email con la misma clave de idempotencia. Los adaptadores de Supabase y Resend permanecerán exclusivamente en servidor.

**Tech Stack:** React 19, TanStack Start, TypeScript, Zod, Supabase, SDK oficial `resend`, Vitest, React Testing Library, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-24-resend-contact-email-design.md`

## Global Constraints

- Destinatario central: `pedro.ortega@españalatente.org`; no enviar al email privado del profesional.
- Remitente visible: `Directorio audiovisual <contacto@españalatente.org>`; usar `Reply-To` del visitante.
- `RESEND_API_KEY` será un secreto de Vercel y nunca aparecerá en variables `VITE_*`, cliente, logs o Git.
- Guardar en `contact_messages` antes de llamar a Resend y conservar la fila si Resend falla.
- Mostrar éxito únicamente después de que Resend acepte la petición.
- Reintentar con el mismo UUID y `contact-message/<uuid>` sin duplicar filas ni correos.
- Preservar cambios locales ajenos; trabajar y desplegar únicamente desde `codex/resend-contact-email` mediante Vercel.

## Review Focus

- Un asunto o mensaje con HTML, saltos o cabeceras debe aparecer escapado en HTML y no alterar asunto/cabeceras; Task 1 lo prueba.
- Un UUID repetido con contenido distinto debe rechazarse como conflicto, no reutilizar otra solicitud; Task 2 lo prueba.
- Un fallo de Resend posterior al guardado debe conservar la fila, devolver error y permitir reintento idempotente; Task 2 lo prueba.
- Un bot que complete el honeypot debe recibir respuesta neutra sin tocar Supabase ni Resend; Task 2 lo prueba.
- Una configuración ausente o un dominio IDN debe fallar de forma accionable y usar la dirección técnica punycode configurada; Task 3 lo prueba.

---

### Task 1: Contratos, validación y composición segura

**Files:**
- Create: `src/lib/contact-message.ts`
- Test: `src/lib/contact-message.test.ts`

**Interfaces:**
- Consumes: Zod y datos del formulario actual.
- Produces: `contactMessageInputSchema`, `ContactMessageInput`, `ContactEmailConfig`, `ContactEmailPayload`, `normalizeContactInput(input)`, `buildContactEmail(input, professionalName, config, submittedAt)` y `contactIdempotencyKey(requestId)`.

- [ ] **Step 1: Escribir pruebas fallidas de validación y normalización**

Añadir pruebas que acepten un UUID, profesional, nombre, email y mensaje válidos; recorten espacios; normalicen el email a minúsculas; y rechacen UUID/email inválidos, nombre de más de 100 caracteres, asunto de más de 160 y mensaje de más de 5.000.

- [ ] **Step 2: Ejecutar la prueba y confirmar RED**

Run: `npm test -- src/lib/contact-message.test.ts`
Expected: FAIL porque `contact-message.ts` todavía no existe.

- [ ] **Step 3: Implementar los contratos mínimos**

Crear el schema con los campos exactos `request_id`, `professional_id`, `sender_name`, `sender_email`, `subject`, `message` y `website`; exportar `normalizeContactInput(input: ContactMessageInput): ContactMessageInput`.

- [ ] **Step 4: Ejecutar y confirmar GREEN**

Run: `npm test -- src/lib/contact-message.test.ts`
Expected: PASS para validación y normalización.

- [ ] **Step 5: Añadir pruebas fallidas de composición**

Comprobar asunto `[Directorio] Contacto para Iñigo Floristán Irisarri: Sin asunto`, `replyTo` normalizado, texto plano completo, HTML escapado para `<script>`, asunto sin CR/LF y clave `contact-message/<uuid>`.

- [ ] **Step 6: Ejecutar y confirmar RED**

Run: `npm test -- src/lib/contact-message.test.ts`
Expected: FAIL porque faltan `buildContactEmail` y `contactIdempotencyKey`.

- [ ] **Step 7: Implementar composición segura mínima**

Implementar `buildContactEmail(input: ContactMessageInput, professionalName: string, config: ContactEmailConfig, submittedAt: Date): ContactEmailPayload` y `contactIdempotencyKey(requestId: string): string`, escapando todos los valores usados en HTML y eliminando CR/LF del asunto.

- [ ] **Step 8: Ejecutar pruebas y commit**

Run: `npm test -- src/lib/contact-message.test.ts`
Expected: PASS.

```bash
git add src/lib/contact-message.ts src/lib/contact-message.test.ts
git commit -m "feat: define contact email contracts"
```

### Task 2: Servicio idempotente de entrega

**Files:**
- Create: `src/lib/contact-message-service.ts`
- Test: `src/lib/contact-message-service.test.ts`

**Interfaces:**
- Consumes: `ContactMessageInput`, `ContactEmailConfig`, `buildContactEmail` y `contactIdempotencyKey` de Task 1.
- Produces: `ContactRepository`, `ContactEmailSender`, `ContactDeliveryDeps`, `ContactDeliveryResult` y `deliverContactMessage(input, deps)`.

- [ ] **Step 1: Escribir prueba fallida del camino correcto**

La prueba debe verificar este orden observable: profesional verificado, inexistencia del UUID, límite reciente, guardado una vez y envío con clave `contact-message/<uuid>`; el resultado será `{ ok: true, contactId, emailId }`.

- [ ] **Step 2: Ejecutar y confirmar RED**

Run: `npm test -- src/lib/contact-message-service.test.ts`
Expected: FAIL porque `deliverContactMessage` no existe.

- [ ] **Step 3: Implementar el servicio mínimo**

Definir `deliverContactMessage(input: ContactMessageInput, deps: ContactDeliveryDeps): Promise<ContactDeliveryResult>` con umbral exacto de 5 mensajes por email normalizado en 30 minutos.

- [ ] **Step 4: Ejecutar y confirmar GREEN**

Run: `npm test -- src/lib/contact-message-service.test.ts`
Expected: PASS para el camino correcto.

- [ ] **Step 5: Añadir pruebas fallidas de fallos y abuso**

Cubrir profesional inexistente/no verificado, sexto mensaje en 30 minutos, honeypot no vacío sin llamadas a dependencias, fallo de guardado, fallo de Resend después del guardado, reintento idéntico y UUID repetido con contenido diferente.

- [ ] **Step 6: Ejecutar y confirmar RED**

Run: `npm test -- src/lib/contact-message-service.test.ts`
Expected: FAIL en los casos todavía no implementados.

- [ ] **Step 7: Completar el servicio sin añadir infraestructura**

El repositorio devolverá `new`, `duplicate_same` o `conflict`; `duplicate_same` reutilizará la clave de idempotencia, `conflict` lanzará error y un fallo de proveedor no eliminará el registro.

- [ ] **Step 8: Ejecutar pruebas y commit**

Run: `npm test -- src/lib/contact-message-service.test.ts`
Expected: PASS para todos los caminos.

```bash
git add src/lib/contact-message-service.ts src/lib/contact-message-service.test.ts
git commit -m "feat: deliver contact messages idempotently"
```

### Task 3: Adaptadores de Supabase/Resend y función de servidor

**Files:**
- Create: `src/lib/contact-message.server.ts`
- Create: `src/lib/contact-message.server.test.ts`
- Create: `src/lib/contact-message.functions.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: interfaces y servicio de Task 2; `supabaseAdmin`; `process.env.RESEND_API_KEY`, `CONTACT_EMAIL_TO`, `CONTACT_EMAIL_FROM`.
- Produces: `readContactEmailConfig(env)`, `createSupabaseContactRepository(db)`, `createResendContactSender(resend)`, `createContactDeliveryDeps()` y `sendContactMessage` como `createServerFn({ method: "POST" })`.

- [ ] **Step 1: Instalar el SDK oficial fijando versión**

Run: `npm install --save-exact resend`
Expected: `package.json` y `package-lock.json` registran una versión exacta, sin rango.

- [ ] **Step 2: Escribir pruebas fallidas de configuración y Resend**

Comprobar que falta de `RESEND_API_KEY`, `CONTACT_EMAIL_TO` o `CONTACT_EMAIL_FROM` produce mensajes accionables; la configuración válida acepta las direcciones técnicas `pedro.ortega@xn--espaalatente-dhb.org` y `Directorio audiovisual <contacto@xn--espaalatente-dhb.org>`; el adaptador pasa `replyTo` y `{ idempotencyKey }` al SDK y transforma `result.error` en excepción. Con un cliente Supabase falso, comprobar también profesional verificado, recuento reciente, inserción nueva, duplicado idéntico y conflicto por contenido diferente.

- [ ] **Step 3: Ejecutar y confirmar RED**

Run: `npm test -- src/lib/contact-message.server.test.ts`
Expected: FAIL porque los adaptadores no existen.

- [ ] **Step 4: Implementar configuración y adaptadores mínimos**

Mantener imports de `client.server` y `resend` dentro de código exclusivo de servidor. El repositorio seleccionará solo `id,full_name,verified`, contará por `sender_email` y `created_at`, insertará con `id=request_id` y comparará todos los campos ante código Postgres `23505`.

- [ ] **Step 5: Ejecutar y confirmar GREEN**

Run: `npm test -- src/lib/contact-message.server.test.ts`
Expected: PASS.

- [ ] **Step 6: Crear la función pública de servidor**

Exportar `sendContactMessage` con `inputValidator(contactMessageInputSchema)` y handler que cargue dinámicamente `createContactDeliveryDeps`, llame a `deliverContactMessage` y solo registre UUID, fase e identificador de Resend, nunca cuerpo, email o secretos.

- [ ] **Step 7: Documentar variables sin secretos**

Añadir a `.env.example`: `RESEND_API_KEY=`, `CONTACT_EMAIL_TO=pedro.ortega@xn--espaalatente-dhb.org` y `CONTACT_EMAIL_FROM="Directorio audiovisual <contacto@xn--espaalatente-dhb.org>"`.

- [ ] **Step 8: Ejecutar pruebas, compilación y commit**

Run: `npm test -- src/lib/contact-message.server.test.ts`
Expected: pruebas PASS.

Run: `npm run build`
Expected: build con exit 0; ningún secreto aparece en `.output/public`.

```bash
git add package.json package-lock.json .env.example src/lib/contact-message.server.ts src/lib/contact-message.server.test.ts src/lib/contact-message.functions.ts
git commit -m "feat: connect contact delivery to Resend"
```

### Task 4: Formulario conectado al backend

**Files:**
- Create: `src/components/ContactDialog.test.ts`
- Modify: `src/components/ContactDialog.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `sendContactMessage` de Task 3 mediante `useServerFn`.
- Produces: formulario que envía `{ data: ContactMessageInput }`, conserva UUID/formulario al fallar y reinicia ambos al tener éxito.

- [ ] **Step 1: Instalar utilidades de componente fijando versiones**

Run: `npm install --save-dev --save-exact @testing-library/react jsdom`
Expected: dependencias exactas y lockfile actualizado.

- [ ] **Step 2: Escribir prueba fallida del envío correcto**

Con `// @vitest-environment jsdom` y `React.createElement` para mantener la extensión `.test.ts` que descubre Vitest, mockear únicamente `useServerFn`/toast; abrir el diálogo, rellenar campos, enviar y comprobar que el servidor recibe UUID, profesional y valores, que aparece éxito y que el diálogo se cierra.

- [ ] **Step 3: Ejecutar y confirmar RED**

Run: `npm test -- src/components/ContactDialog.test.ts`
Expected: FAIL porque el componente todavía inserta directamente en Supabase.

- [ ] **Step 4: Conectar el componente a `sendContactMessage`**

Eliminar el cliente Supabase del componente, añadir `useServerFn(sendContactMessage)`, un campo honeypot visualmente oculto y un UUID estable creado al primer intento.

- [ ] **Step 5: Ejecutar y confirmar GREEN**

Run: `npm test -- src/components/ContactDialog.test.ts`
Expected: PASS para el envío correcto.

- [ ] **Step 6: Añadir pruebas fallidas de error y reintento**

Comprobar que un rechazo mantiene abierto el diálogo y conserva campos/UUID; el siguiente submit reutiliza el UUID; tras éxito se limpia y el siguiente mensaje obtiene otro UUID.

- [ ] **Step 7: Implementar manejo mínimo de error/reintento**

Usar `try/catch/finally`; mostrar `No se pudo enviar el mensaje` sin detalles internos y no limpiar el formulario hasta el éxito.

- [ ] **Step 8: Ejecutar pruebas y commit**

Run: `npm test -- src/components/ContactDialog.test.ts`
Expected: PASS.

```bash
git add package.json package-lock.json src/components/ContactDialog.tsx src/components/ContactDialog.test.ts
git commit -m "feat: submit contact form through server"
```

### Task 5: Verificación completa y despliegue en Vercel

**Files:**
- Modify only if verification uncovers a defect: files owned by Tasks 1–4.

**Interfaces:**
- Consumes: rama completa y credenciales creadas por el usuario en Resend.
- Produces: preview verificado y, después, despliegue de producción del mismo commit.

- [ ] **Step 1: Verificación local completa**

Run: `npm test`
Expected: todos los archivos y pruebas PASS.

Run: `npm run build`
Expected: exit 0.

Run: `git diff --check 6424bb8..HEAD`
Expected: sin salida.

- [ ] **Step 2: Configurar Resend manualmente**

El usuario crea la cuenta con `pedro.ortega@españalatente.org`, añade `españalatente.org` en Resend, publica los registros SPF/DKIM indicados y crea una API key restringida a envío. No copiar la clave en chat ni archivos versionados.

- [ ] **Step 3: Configurar variables de Vercel**

Guardar `RESEND_API_KEY` como Secret en Preview y Production con valores separados si la política del equipo lo exige. Guardar `CONTACT_EMAIL_TO=pedro.ortega@xn--espaalatente-dhb.org` y `CONTACT_EMAIL_FROM="Directorio audiovisual <contacto@xn--espaalatente-dhb.org>"` como Config.

- [ ] **Step 4: Publicar la rama y esperar preview READY**

Run: `git push -u origin codex/resend-contact-email`
Expected: Vercel crea un preview del commit actual y termina en `READY` sin errores de build.

- [ ] **Step 5: Prueba end-to-end en preview**

Enviar un contacto desde la ficha de Iñigo y comprobar: respuesta de servidor exitosa, una sola fila en `contact_messages` (mediante el Table Editor si el proyecto sigue sin estar conectado al MCP), un envío aceptado en Resend, recepción en `pedro.ortega@españalatente.org` y `Reply-To` igual al email usado en el formulario.

- [ ] **Step 6: Revisar logs y contenido público**

Confirmar que Vercel/Resend no muestran secretos ni cuerpo completo; buscar `RESEND_API_KEY` y su valor en `.output/public` debe devolver cero coincidencias.

- [ ] **Step 7: Promover el mismo commit a producción**

Crear el despliegue de producción desde `codex/resend-contact-email`, esperar `READY`, verificar los alias de `mapa.españalatente.org` y repetir un contacto real.

- [ ] **Step 8: Verificación posterior**

Confirmar home, mapa y ficha de Iñigo con HTTP 200; correo recibido; cero errores/fatales recientes en Vercel; registrar deployment ID y commit en el informe final.
