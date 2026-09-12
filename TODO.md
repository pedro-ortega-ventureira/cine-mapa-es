# Pendientes

## Imagen de vista previa alojada en Lovable

`src/routes/__root.tsx` usa como `og:image` y `twitter:image` una captura
guardada en el bucket R2 de Lovable
(`pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/...lovable.app-...png`).

Al dejar Lovable esa imagen queda fuera de nuestro control: si algún día deja de
servirse, las vistas previas en redes y mensajería aparecerán sin imagen. Hay que
poner una propia en `public/` y apuntar ahí las dos etiquetas.

## Restos inertes del sistema de errores de Lovable

`src/lib/lovable-error-reporting.ts` envía los errores a `window.__lovableEvents`,
un objeto que sólo existía dentro del entorno de Lovable. Fuera de él no hace nada
(todas las llamadas van con `?.`), así que no molesta, pero es código muerto: o se
borra junto con su uso en `src/routes/__root.tsx`, o se reescribe para enviar los
errores a donde queramos vigilarlos.

## Acceso con Google

Se retiró al salir de Lovable, que era quien hacía de intermediario del OAuth.
Nunca llegó a usarlo nadie: las 15 cuentas existentes son de correo y contraseña.
Para recuperarlo hay que dar de alta credenciales OAuth en Google Cloud,
configurarlas en Supabase (Authentication → Providers) y llamar a
`supabase.auth.signInWithOAuth({ provider: "google" })` desde `auth.tsx` y
`registro.tsx`.

## Códigos postales incompletos en `municipalities`

Hay 11.005 códigos cargados, pero 11 municipios no tienen ninguno y 2.271 códigos
figuran en más de un municipio. El autorrelleno del formulario de alta sólo actúa
cuando el código identifica un único municipio; conviene completar el listado si
se quiere que acierte más a menudo.

---

## Resuelto

- **Panel admin en blanco para usuarios sin rol admin** (detectado 19/07/2026):
  arreglado en el commit `0fa719a`, que muestra un aviso de acceso restringido.
