import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  buildPostalCodeAssignments,
  indexPostalCodesByIne,
  type DbMunicipality,
  type GeoMunicipality,
} from "@/lib/postal-codes-geo";

// Admin-only loader: rellena municipalities.postal_codes[] a partir del
// GeoJSON local de municipios de menos de 20.000 habitantes
// (/geo/municipios-lt20k.geojson: codigo_postal, codigo_ine, municipio,
// provincia) y, como complemento, de un listado público CP↔INE para cubrir
// los códigos postales secundarios de cada municipio.
//
// La tabla `municipalities` usa un `code` propio (slug provincia-municipio),
// no el INE, así que el cruce se hace por nombre normalizado + provincia.
// Requiere un token Supabase válido de un usuario con rol `admin`.
const CP_DATASET_URL =
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
          const supabaseAuthCheck = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { data: claimsData, error: claimsError } =
            await supabaseAuthCheck.auth.getClaims(token);
          const userId = claimsData?.claims?.sub as string | undefined;
          if (claimsError || !userId) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc("has_role", {
            _user_id: userId,
            _role: "admin",
          });
          if (roleError || !isAdmin) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }

          // 1. GeoJSON local (misma app), única fuente obligatoria.
          const geoUrl = new URL("/geo/municipios-lt20k.geojson", request.url);
          const geoRes = await fetch(geoUrl);
          if (!geoRes.ok) {
            return Response.json(
              { error: `GeoJSON fetch failed: ${geoRes.status}` },
              { status: 502 },
            );
          }
          const geoJson = (await geoRes.json()) as {
            features?: Array<{ properties?: GeoMunicipality }>;
          };
          const geoFeatures: GeoMunicipality[] = (geoJson.features ?? [])
            .map((f) => f.properties ?? {})
            .filter((p) => p && p.municipio);

          // 2. Listado CP↔INE (opcional): añade los CP secundarios.
          let postalCodesByIne = new Map<string, Set<string>>();
          let cpDatasetRows = 0;
          try {
            const cpRes = await fetch(CP_DATASET_URL);
            if (cpRes.ok) {
              const rows = (await cpRes.json()) as Array<Record<string, unknown>>;
              cpDatasetRows = rows.length;
              postalCodesByIne = indexPostalCodesByIne(rows);
            }
          } catch {
            // Sin el listado externo seguimos: el GeoJSON ya aporta el CP de cabecera.
          }

          // 3. Municipios de la base de datos (paginado: PostgREST corta a 1.000).
          const dbMunicipalities: DbMunicipality[] = [];
          const PAGE = 1000;
          for (let from = 0; ; from += PAGE) {
            const { data, error } = await supabaseAdmin
              .from("municipalities")
              .select("code,name,province")
              .order("code")
              .range(from, from + PAGE - 1);
            if (error) return Response.json({ error: error.message }, { status: 500 });
            const page = (data ?? []) as DbMunicipality[];
            dbMunicipalities.push(...page);
            if (page.length < PAGE) break;
          }

          const { items, unmatched, postalCodeCount } = buildPostalCodeAssignments(
            geoFeatures,
            dbMunicipalities,
            postalCodesByIne,
          );

          const CHUNK = 500;
          let rowsUpdated = 0;
          for (let i = 0; i < items.length; i += CHUNK) {
            const slice = items.slice(i, i + CHUNK);
            const { data, error } = await supabaseAdmin.rpc("seed_postal_codes_batch", {
              _payload: slice as unknown as never,
            });
            if (error) {
              return Response.json(
                { error: error.message, processed: rowsUpdated },
                { status: 500 },
              );
            }
            rowsUpdated += Number(data ?? 0);
          }

          return Response.json({
            ok: true,
            geo_features: geoFeatures.length,
            cp_dataset_rows: cpDatasetRows,
            db_municipalities: dbMunicipalities.length,
            matched: items.length,
            unmatched: unmatched.length,
            unmatched_sample: unmatched.slice(0, 20),
            postal_codes_assigned: postalCodeCount,
            rows_updated: rowsUpdated,
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
