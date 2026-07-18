import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Admin-only loader: fetches a public dataset of Spanish postal codes ↔ INE
// municipality codes and writes them to municipalities.postal_codes[].
// Requires a valid Supabase bearer token from a user with the `admin` role.
const DATASET_URL =
  "https://raw.githubusercontent.com/d-maza/codigos-postales-spain/master/codigos-postales.json";

export const Route = createFileRoute("/api/public/seed-postal-codes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization") ?? "";
          if (!authHeader.startsWith("Bearer ")) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }
          const token = authHeader.slice("Bearer ".length).trim();
          if (!token) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const SUPABASE_URL = process.env.SUPABASE_URL!;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const supabaseAuthCheck = createClient(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );

          const { data: claimsData, error: claimsError } =
            await supabaseAuthCheck.auth.getClaims(token);
          const userId = claimsData?.claims?.sub as string | undefined;
          if (claimsError || !userId) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );
          const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc(
            "has_role",
            { _user_id: userId, _role: "admin" },
          );
          if (roleError || !isAdmin) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }

          const res = await fetch(DATASET_URL);
          if (!res.ok) {
            return Response.json(
              { error: `Dataset fetch failed: ${res.status}` },
              { status: 502 },
            );
          }
          const raw = (await res.json()) as Array<Record<string, unknown>>;

          const byMuni = new Map<string, Set<string>>();
          for (const row of raw) {
            const ine = String(row["municipio_id"] ?? row["cod_municipio"] ?? "").padStart(5, "0");
            const cp = String(row["codigo_postal"] ?? row["cp"] ?? "").padStart(5, "0");
            if (!/^\d{5}$/.test(ine) || !/^\d{5}$/.test(cp)) continue;
            if (!byMuni.has(ine)) byMuni.set(ine, new Set());
            byMuni.get(ine)!.add(cp);
          }

          const items = Array.from(byMuni.entries()).map(([code, cps]) => ({
            code,
            postal_codes: Array.from(cps),
          }));

          const CHUNK = 500;
          let totalUpdated = 0;
          for (let i = 0; i < items.length; i += CHUNK) {
            const slice = items.slice(i, i + CHUNK);
            const { data, error } = await supabaseAdmin.rpc("seed_postal_codes_batch", {
              _payload: slice as unknown as never,
            });
            if (error) {
              return Response.json(
                { error: error.message, processed: totalUpdated },
                { status: 500 },
              );
            }
            totalUpdated += Number(data ?? 0);
          }

          return Response.json({
            ok: true,
            source_rows: raw.length,
            municipalities_with_cp: byMuni.size,
            rows_updated: totalUpdated,
          });
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
