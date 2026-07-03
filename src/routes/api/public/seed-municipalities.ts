import { createFileRoute } from "@tanstack/react-router";
import { seedMunicipalities } from "@/lib/municipalities.functions";

// Public seeder — idempotent, only inserts if table is empty.
export const Route = createFileRoute("/api/public/seed-municipalities")({
  server: {
    handlers: {
      GET: async () => {
        try {
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
