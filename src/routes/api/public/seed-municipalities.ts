import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { seedMunicipalities } from "@/lib/municipalities.functions";

// Admin-only seeder. Requires a valid Supabase bearer token from a user
// with the `admin` role. Kept under /api/public to avoid the SSR auth
// gate; auth is enforced explicitly in the handler.
export const Route = createFileRoute("/api/public/seed-municipalities")({
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
          const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { data: claimsData, error: claimsError } =
            await supabase.auth.getClaims(token);
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

          const result = await seedMunicipalities();
          return Response.json(result);
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
