# Diagnóstico: «Esta página no cargó» tras el commit 30200661

## Qué he comprobado (sin tocar código)

- El commit borró el archivo `.env` que estaba versionado. Contenía la dirección y la clave pública de una base de datos **antigua** (referencia `yriem…`).
- La base de datos activa del proyecto ahora es **otra** (referencia `dmors…`). La configuración que la plataforma inyecta en el entorno de trabajo apunta a esa base nueva.
- En el entorno de trabajo actual el archivo de configuración vuelve a existir (lo regenera la plataforma) y las páginas cargan bien: inicio, directorio y registro responden 200, sin errores de arranque ni errores en consola.
- El código de la aplicación lanza un error explícito cuando faltan la dirección y la clave de la base de datos. Ese error ocurre al pintar la página en el servidor, y la pantalla que se muestra en ese caso es exactamente «Esta página no cargó».
- El resto de cambios del commit (cabecera, registro, ubicación en mapa) no contienen nada que rompa el renderizado: no he encontrado ningún fallo de compilación ni de ejecución.
- `supabase/config.toml` sigue apuntando a la referencia antigua `yriem…` (archivo autogenerado, resto informativo).

## Causa exacta

La vista previa de ese commit se quedó **sin los datos de conexión a la base de datos**: la aplicación los tomaba del archivo `.env` versionado, y al borrarlo la compilación de esa vista previa se construyó sin ellos. Al no encontrarlos, la aplicación lanza el error "faltan variables de Supabase" mientras genera la página en el servidor, y el sistema responde con la pantalla genérica «Esta página no cargó» en todas las rutas.

No es un fallo del código nuevo del commit, ni de la base de datos (está activa y responde).

Matiz honesto: no tengo acceso a los registros de esa compilación concreta de la vista previa, así que esta causa está deducida del contenido del commit, del comportamiento del código ante configuración ausente y de que el entorno actual, con configuración presente, funciona sin errores.

## Corrección segura para publicar

1. **No volver a versionar el archivo `.env`.** Es correcto que esté fuera del control de versiones (ya está excluido) y contenía además datos de una base de datos que ya no se usa. Volver a subirlo apuntaría la web a la base antigua y vacía.
2. **Republicar desde el estado actual.** El entorno actual ya tiene la configuración correcta inyectada por la plataforma y las páginas cargan; una nueva publicación regenera la vista previa y el sitio con esos valores.
3. **Verificar tras publicar** inicio, directorio, mapa, una ficha de profesional y registro. Si alguna siguiera mostrando la pantalla de error, el problema sería de inyección de configuración en el entorno publicado y no del código.
4. **Opcional, limpieza:** `supabase/config.toml` conserva la referencia de la base antigua. No afecta a la web publicada, pero conviene que se regenere para evitar confusiones futuras.

## Detalles técnicos

- Puntos de lectura: `src/integrations/supabase/client.ts` usa `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` con respaldo a `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`; `auth-middleware.ts` y las rutas `api/public/seed-*` leen las de servidor. Todos lanzan `Error` si faltan.
- La pantalla de error procede de `renderErrorPage()` en `src/server.ts` / `src/routes/__root.tsx`, que captura cualquier excepción de renderizado en servidor.
- Rutas con `loader` que consultan la base durante el renderizado en servidor: `src/routes/profesionales.$slug.tsx` y `src/routes/municipios.$codigo.tsx`; por eso el fallo se ve en toda la navegación y no solo en una página.
