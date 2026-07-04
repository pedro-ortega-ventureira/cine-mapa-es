import { createFileRoute } from "@tanstack/react-router";

// One-shot loader: fetches a public dataset of Spanish postal codes ↔ INE municipality
// codes and writes them to municipalities.postal_codes[]. Idempotent.
// Source: https://github.com/d-maza/codigos-postales-spain (public aggregation of INE data).
const DATASET_URL =
  "https://raw.githubusercontent.com/d-maza/codigos-postales-spain/master/codigos-postales.json";


export const Route = createFileRoute("/api/public/seed-postal-codes")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const res = await fetch(DATASET_URL);
          if (!res.ok) {
            return Response.json(
              { error: `Dataset fetch failed: ${res.status}` },
              { status: 502 },
            );
          }
          const raw = (await res.json()) as Array<Record<string, unknown>>;

          // Group CPs by INE municipality code
          const byMuni = new Map<string, Set<string>>();
          for (const row of raw) {
            const ine = String(row["municipio_id"] ?? row["cod_municipio"] ?? "").padStart(5, "0");
            const cp = String(row["codigo_postal"] ?? row["cp"] ?? "").padStart(5, "0");
            if (!/^\d{5}$/.test(ine) || !/^\d{5}$/.test(cp)) continue;
            if (!byMuni.has(ine)) byMuni.set(ine, new Set());
            byMuni.get(ine)!.add(cp);
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
