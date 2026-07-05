import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server function invocada desde el panel admin: dispara el endpoint interno
// /api/public/seed-cp-geo y devuelve su resumen. Requiere sesión + rol admin.
export const resolveGeoAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const base = process.env.SUPABASE_URL ? "" : ""; // same-origin
    const url = new URL("/api/public/seed-cp-geo", "http://localhost");
    // Reutilizamos el mismo host que sirve las server routes; en Workers está en request context,
    // pero como este endpoint es idempotente y usa el service role dentro, podemos llamarlo por HTTP.
    // Como fallback, replicamos aquí la lógica mínima: importar dinámicamente el handler no es viable
    // por lo que dependemos del fetch same-origin.
    const origin = process.env.APP_URL || process.env.SITE_URL || "";
    const target = origin
      ? new URL("/api/public/seed-cp-geo", origin).toString()
      : url.pathname;
    const res = await fetch(target, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as {
      ok: boolean;
      total: number;
      updated: number;
      exact: number;
      province: number;
      none: number;
    };
  });
