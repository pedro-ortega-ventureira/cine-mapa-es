import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROVINCE_BY_CP2, normalizePostalCode } from "@/lib/spain-provinces";

// Resuelve la geolocalización de todos los profesionales a partir de `raw_postal_code`.
// Solo un administrador puede lanzarlo. Idempotente.
export const resolveProfessionalGeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { data: pros, error: readErr } = await context.supabase
      .from("professionals")
      .select("id, raw_postal_code");
    if (readErr) throw new Error(readErr.message);
    const rows = pros ?? [];

    type Hit = { lat: number; lng: number; muni: string; prov: string };
    const cpCache = new Map<string, Hit | null>();

    async function lookupCp(cp: string): Promise<Hit | null> {
      try {
        const res = await fetch(`https://api.zippopotam.us/es/${cp}`, {
          signal: AbortSignal.timeout(6000),
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

    type Resolved = {
      id: string;
      geo_lat: number | null;
      geo_lng: number | null;
      geo_accuracy: "exact" | "province" | "none";
      geo_municipality_name: string | null;
      geo_province: string | null;
    };
    const resolved: Resolved[] = new Array(rows.length);

    // Resolver con concurrencia moderada
    const CONCURRENCY = 6;
    let cursor = 0;
    async function worker() {
      while (true) {
        const i = cursor++;
        if (i >= rows.length) return;
        const p = rows[i];
        const cp = normalizePostalCode(p.raw_postal_code as string | null);
        if (!cp) {
          resolved[i] = {
            id: p.id,
            geo_lat: null,
            geo_lng: null,
            geo_accuracy: "none",
            geo_municipality_name: null,
            geo_province: null,
          };
          continue;
        }
        let hit = cpCache.get(cp);
        if (hit === undefined) {
          hit = await lookupCp(cp);
          cpCache.set(cp, hit);
        }
        if (hit) {
          resolved[i] = {
            id: p.id,
            geo_lat: hit.lat,
            geo_lng: hit.lng,
            geo_accuracy: "exact",
            geo_municipality_name: hit.muni,
            geo_province: hit.prov,
          };
        } else {
          const prov = PROVINCE_BY_CP2[cp.slice(0, 2)];
          if (prov) {
            resolved[i] = {
              id: p.id,
              geo_lat: prov.lat,
              geo_lng: prov.lng,
              geo_accuracy: "province",
              geo_municipality_name: null,
              geo_province: prov.name,
            };
          } else {
            resolved[i] = {
              id: p.id,
              geo_lat: null,
              geo_lng: null,
              geo_accuracy: "none",
              geo_municipality_name: null,
              geo_province: null,
            };
          }
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    // Escritura fila a fila (context.supabase actúa como admin por RLS).
    // Evitamos upsert masivo para no requerir permisos adicionales.
    let updated = 0;
    for (const r of resolved) {
      const { error: upErr } = await context.supabase
        .from("professionals")
        .update({
          geo_lat: r.geo_lat,
          geo_lng: r.geo_lng,
          geo_accuracy: r.geo_accuracy,
          geo_municipality_name: r.geo_municipality_name,
          geo_province: r.geo_province,
        })
        .eq("id", r.id);
      if (!upErr) updated += 1;
    }

    return {
      ok: true,
      total: rows.length,
      updated,
      exact: resolved.filter((r) => r.geo_accuracy === "exact").length,
      province: resolved.filter((r) => r.geo_accuracy === "province").length,
      none: resolved.filter((r) => r.geo_accuracy === "none").length,
      unique_cps: cpCache.size,
    };
  });
