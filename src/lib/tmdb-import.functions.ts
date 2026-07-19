import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin only");
}

// service_role: authenticated nunca tuvo GRANT de escritura sobre
// professionals/filmography_items, y aquí el admin ya se validó con
// assertAdmin() justo antes de llamar a esto.
async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// Vincula (o desvincula, con tmdb_person_id: null) un profesional con su
// persona en TMDB. No importa nada por sí solo — ver importTmdbFilmography.
export const linkTmdbPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        professional_id: z.string().uuid(),
        tmdb_person_id: z.number().int().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await getAdminClient();
    const { error } = await db
      .from("professionals")
      .update({ tmdb_person_id: data.tmdb_person_id })
      .eq("id", data.professional_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type TmdbCredit = {
  id: number;
  media_type?: "movie" | "tv";
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
  vote_average?: number;
  character?: string;
  job?: string;
  department?: string;
};

type CreditType =
  | "director"
  | "writer"
  | "producer"
  | "cast"
  | "crew"
  | "composer"
  | "cinematographer"
  | "editor"
  | "sound"
  | "other";

const JOB_TO_CREDIT_TYPE: Record<string, CreditType> = {
  director: "director",
  writer: "writer",
  screenplay: "writer",
  producer: "producer",
  "executive producer": "producer",
  composer: "composer",
  "original music composer": "composer",
  "director of photography": "cinematographer",
  cinematography: "cinematographer",
  editor: "editor",
  "sound designer": "sound",
  "sound re-recording mixer": "sound",
  sound: "sound",
};

function creditTypeFor(credit: TmdbCredit, fromCrew: boolean): CreditType {
  if (!fromCrew) return "cast";
  const job = (credit.job ?? "").toLowerCase();
  if (JOB_TO_CREDIT_TYPE[job]) return JOB_TO_CREDIT_TYPE[job];
  const dept = (credit.department ?? "").toLowerCase();
  if (dept === "directing") return "director";
  if (dept === "writing") return "writer";
  if (dept === "production") return "producer";
  if (dept === "camera") return "cinematographer";
  if (dept === "editing") return "editor";
  if (dept === "sound") return "sound";
  return "crew";
}

// Trae toda la filmografía conocida de una persona en TMDB
// (GET /person/{id}/combined_credits) y la vuelca en filmography_items.
// Idempotente: usa el índice único (professional_id, tmdb_id, type) para
// hacer upsert, así que se puede volver a lanzar sin duplicar créditos.
export const importTmdbFilmography = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ professional_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await getAdminClient();

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) throw new Error("TMDB API key not configured. Añade TMDB_API_KEY a los secretos.");

    const { data: pro, error: proErr } = await db
      .from("professionals")
      .select("id, tmdb_person_id")
      .eq("id", data.professional_id)
      .single();
    if (proErr) throw new Error(proErr.message);
    if (!pro?.tmdb_person_id) {
      throw new Error("Este profesional no tiene una persona de TMDB vinculada todavía.");
    }

    const url = `https://api.themoviedb.org/3/person/${pro.tmdb_person_id}/combined_credits?api_key=${apiKey}&language=es-ES`;
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) throw new Error(json?.status_message || "Error consultando TMDB");

    const cast = (json.cast ?? []) as TmdbCredit[];
    const crew = (json.crew ?? []) as TmdbCredit[];

    // Combina cast+crew por (media_type, id): si aparece en ambos (p.ej.
    // actor y director de la misma película), nos quedamos con el crédito
    // de crew para el rol/tipo, que suele ser más específico.
    const merged = new Map<string, { credit: TmdbCredit; fromCrew: boolean }>();
    for (const c of cast) {
      const mt = c.media_type === "tv" ? "tv" : "movie";
      merged.set(`${mt}:${c.id}`, { credit: c, fromCrew: false });
    }
    for (const c of crew) {
      const mt = c.media_type === "tv" ? "tv" : "movie";
      const key = `${mt}:${c.id}`;
      const existing = merged.get(key);
      merged.set(key, {
        credit: { ...existing?.credit, ...c },
        fromCrew: true,
      });
    }

    const rows = [...merged.entries()].map(([key, { credit, fromCrew }]) => {
      const [mt] = key.split(":");
      const isMovie = mt === "movie";
      const title = (isMovie ? credit.title : credit.name) ?? credit.title ?? credit.name ?? "";
      const original = (isMovie ? credit.original_title : credit.original_name) ?? title;
      const dateStr = isMovie ? credit.release_date : credit.first_air_date;
      const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) || null : null;
      return {
        professional_id: data.professional_id,
        tmdb_id: credit.id,
        title,
        original_title: original,
        type: (isMovie ? "movie" : "tv") as "movie" | "tv",
        year,
        role_in_production: fromCrew ? credit.job ?? null : credit.character ?? null,
        credit_type: creditTypeFor(credit, fromCrew),
        poster_url: credit.poster_path ? `https://image.tmdb.org/t/p/w342${credit.poster_path}` : null,
        synopsis: credit.overview ?? null,
        tmdb_rating: credit.vote_average ?? null,
      };
    });

    if (rows.length === 0) {
      return { ok: true, imported: 0 };
    }

    const { error: upsertErr } = await db
      .from("filmography_items")
      .upsert(rows, { onConflict: "professional_id,tmdb_id,type" });
    if (upsertErr) throw new Error(upsertErr.message);

    return { ok: true, imported: rows.length };
  });
