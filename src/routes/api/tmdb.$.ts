import { createFileRoute } from "@tanstack/react-router";

// Server-side TMDB proxy — keeps API key hidden from clients.
// Client calls /api/tmdb/search/multi?query=... etc.
export const Route = createFileRoute("/api/tmdb/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const apiKey = process.env.TMDB_API_KEY;
        if (!apiKey) {
          return Response.json(
            { error: "TMDB API key not configured. Add TMDB_API_KEY to secrets." },
            { status: 503 },
          );
        }
        const path = params._splat || "";
        const url = new URL(request.url);
        const qp = new URLSearchParams(url.search);
        qp.set("api_key", apiKey);
        qp.set("language", qp.get("language") ?? "es-ES");
        const tmdbUrl = `https://api.themoviedb.org/3/${path}?${qp.toString()}`;
        try {
          const r = await fetch(tmdbUrl);
          const data = await r.json();
          return new Response(JSON.stringify(data), {
            status: r.status,
            headers: {
              "content-type": "application/json",
              "cache-control": "public, max-age=300",
            },
          });
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "TMDB request failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
