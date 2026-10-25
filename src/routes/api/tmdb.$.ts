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
        const allowedPath = /^(search\/(multi|person)|person\/\d+\/combined_credits)$/;
        if (!allowedPath.test(path)) {
          return Response.json({ error: "TMDB endpoint not allowed" }, { status: 404 });
        }
        const url = new URL(request.url);
        const qp = new URLSearchParams(url.search);
        const query = qp.get("query");
        if ((path.startsWith("search/") && (!query || query.trim().length < 2 || query.length > 120))) {
          return Response.json({ error: "Invalid search query" }, { status: 400 });
        }
        if (path.startsWith("person/") && qp.has("query")) {
          return Response.json({ error: "Query parameter not allowed" }, { status: 400 });
        }
        for (const key of [...qp.keys()]) {
          if (!["query", "language", "page"].includes(key)) qp.delete(key);
        }
        const page = Number(qp.get("page") ?? "1");
        if (!Number.isInteger(page) || page < 1 || page > 10) {
          return Response.json({ error: "Invalid page" }, { status: 400 });
        }
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
              "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
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
