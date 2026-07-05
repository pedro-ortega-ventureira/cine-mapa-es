import { createFileRoute } from "@tanstack/react-router";
import { PROVINCE_BY_CP2, normalizePostalCode } from "@/lib/spain-provinces";

// Resuelve la geolocalización de cada profesional a partir de su `raw_postal_code`.
// - CP válido → coordenadas exactas vía api.zippopotam.us/es/<cp> (gratis, sin API key).
// - Solo 2 primeros dígitos válidos → centroide provincial (marcado como aproximado).
// - Sin CP válido → geo_accuracy = 'none'.
// Idempotente: puede llamarse varias veces sin efectos secundarios.

type GeoRow = {
  id: string;
  lat: number | null;
  lng: number | null;
  accuracy: "exact" | "province" | "none";
  muni: string | null;
  prov: string | null;
};

async function lookupCp(cp: string): Promise<{ lat: number; lng: number; muni: string; prov: string } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/es/${cp}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      places?: Array<{ latitude: string; longitude: string; "place name": string; state: string }>;
    };
    const place = json.places?.[0];
    if (!place) return null;
    const lat = parseFloat(place.latitude);
    const lng = parseFloat(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, muni: place["place name"], prov: place.state };
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/seed-cp-geo")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: pros, error: readErr } = await supabaseAdmin
            .from("professionals")
            .select("id, raw_postal_code");
          if (readErr) return Response.json({ error: readErr.message }, { status: 500 });

          const rows: GeoRow[] = [];
          const cpCache = new Map<string, { lat: number; lng: number; muni: string; prov: string } | null>();

          const CONCURRENCY = 6;
          let cursor = 0;
          const total = pros?.length ?? 0;

          async function worker() {
            while (true) {
              const i = cursor++;
              if (i >= total) return;
              const p = pros![i];
              const cp = normalizePostalCode(p.raw_postal_code as string | null);
              if (!cp) {
                rows.push({ id: p.id, lat: null, lng: null, accuracy: "none", muni: null, prov: null });
                continue;
              }
              let hit = cpCache.get(cp);
              if (hit === undefined) {
                hit = await lookupCp(cp);
                cpCache.set(cp, hit);
              }
              if (hit) {
                rows.push({ id: p.id, lat: hit.lat, lng: hit.lng, accuracy: "exact", muni: hit.muni, prov: hit.prov });
              } else {
                const prov = PROVINCE_BY_CP2[cp.slice(0, 2)];
                if (prov) {
                  rows.push({
                    id: p.id,
                    lat: prov.lat,
                    lng: prov.lng,
                    accuracy: "province",
                    muni: null,
                    prov: prov.name,
                  });
                } else {
                  rows.push({ id: p.id, lat: null, lng: null, accuracy: "none", muni: null, prov: null });
                }
              }
            }
          }
          await Promise.all(Array.from({ length: CONCURRENCY }, worker));

          // Batch insert
          const CHUNK = 200;
          let updated = 0;
          for (let i = 0; i < rows.length; i += CHUNK) {
            const slice = rows.slice(i, i + CHUNK);
            const payload = slice.map((r) => ({
              id: r.id,
              lat: r.lat != null ? String(r.lat) : "",
              lng: r.lng != null ? String(r.lng) : "",
              accuracy: r.accuracy,
              muni: r.muni ?? "",
              prov: r.prov ?? "",
            }));
            const { data, error } = await supabaseAdmin.rpc("set_professional_geo_batch", {
              _payload: payload as unknown as never,
            });
            if (error) return Response.json({ error: error.message, updated }, { status: 500 });
            updated += Number(data ?? 0);
          }

          const summary = {
            ok: true,
            total,
            updated,
            exact: rows.filter((r) => r.accuracy === "exact").length,
            province: rows.filter((r) => r.accuracy === "province").length,
            none: rows.filter((r) => r.accuracy === "none").length,
            unique_cps: cpCache.size,
          };
          return Response.json(summary);
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
