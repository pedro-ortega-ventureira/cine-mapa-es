// Configuración de build propia, sin @lovable.dev/vite-tanstack-config.
//
// Reproduce lo que hacía aquel paquete (tailwind, tsconfig paths, tanstackStart,
// nitro, react, inyección de VITE_*, alias @, dedupe de React/TanStack), con dos
// diferencias deliberadas:
//   - nitro apunta a Vercel, no a Cloudflare;
//   - se han omitido los plugins que sólo tenían sentido dentro del sandbox de
//     Lovable (component tagger, bridge del servidor de desarrollo, hmr gate,
//     proxy de assets y los registradores de errores del sandbox).
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(async ({ mode, command }) => {
  // Vite sólo expone VITE_* en import.meta.env cuando el código se compila para
  // el cliente; estas definiciones las dejan disponibles también en el bundle
  // de servidor, que es de donde las lee src/integrations/supabase/client.ts.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const define = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  const plugins = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Impide que un import de servidor acabe en el bundle del navegador.
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      // src/server.ts es nuestro envoltorio de errores de SSR; nitro construye
      // a partir de esta entrada.
      server: { entry: "server" },
    }),
  ];

  // nitro sólo interviene en el build: en desarrollo sobra.
  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    // El preset de Vercel escribe en .vercel/output (Build Output API v3), que
    // Vercel detecta sin necesidad de vercel.json.
    plugins.push(nitro({ preset: "vercel" }));
  }

  plugins.push(viteReact());

  return {
    define,
    // "as const" para que el tipo sea el literal que espera Vite y no `string`.
    css: { transformer: "lightningcss" as const },
    resolve: {
      alias: { "@": path.resolve(process.cwd(), "src") },
      // Una segunda copia de React o del query client rompe los hooks.
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    plugins,
    server: { host: "::", port: 8080 },
  };
});
