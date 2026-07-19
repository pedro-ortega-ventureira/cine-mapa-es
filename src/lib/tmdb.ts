export type TmdbSearchResult = {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
  vote_average?: number;
};

export type TmdbPersonResult = {
  id: number;
  name: string;
  profile_path?: string | null;
  known_for_department?: string;
  known_for?: Array<{ title?: string; name?: string; release_date?: string; first_air_date?: string }>;
  popularity?: number;
};

export const tmdbImg = (path: string | null | undefined, size = "w342") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

export async function tmdbSearch(query: string): Promise<TmdbSearchResult[]> {
  if (!query.trim()) return [];
  const r = await fetch(`/api/tmdb/search/multi?query=${encodeURIComponent(query)}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || "TMDB error");
  return (data.results ?? []).filter((x: TmdbSearchResult) =>
    x.media_type === "movie" || x.media_type === "tv",
  );
}

export async function tmdbSearchPerson(query: string): Promise<TmdbPersonResult[]> {
  if (!query.trim()) return [];
  const r = await fetch(`/api/tmdb/search/person?query=${encodeURIComponent(query)}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || "TMDB error");
  return (data.results ?? []) as TmdbPersonResult[];
}

export function normalizeTmdbItem(x: TmdbSearchResult) {
  const isMovie = x.media_type === "movie";
  const title = (isMovie ? x.title : x.name) ?? "";
  const original = (isMovie ? x.original_title : x.original_name) ?? title;
  const dateStr = isMovie ? x.release_date : x.first_air_date;
  const year = dateStr ? parseInt(dateStr.slice(0, 4)) : null;
  return {
    tmdb_id: x.id,
    title,
    original_title: original,
    type: (isMovie ? "movie" : "tv") as "movie" | "tv",
    year,
    poster_url: tmdbImg(x.poster_path),
    synopsis: x.overview ?? null,
    tmdb_rating: x.vote_average ?? null,
  };
}
