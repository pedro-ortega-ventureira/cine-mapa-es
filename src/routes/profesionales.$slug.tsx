import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { lazy, Suspense, useEffect, useState } from "react";
import { Award, GraduationCap, MapPin, Globe, Languages, Mail, Video, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContactDialog } from "@/components/ContactDialog";
import { colorForRole } from "@/lib/roles";

const MunicipalityContourMap = lazy(() =>
  import("@/components/MunicipalityContourMap").then((m) => ({
    default: m.MunicipalityContourMap,
  })),
);

export const Route = createFileRoute("/profesionales/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("professionals")
      .select("*, filmography_items(*), municipalities(*)")
      .eq("slug", params.slug)
      .eq("verified", true)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Perfil no disponible" }, { name: "robots", content: "noindex" }] };
    }
    const p = loaderData as any;
    return {
      meta: [
        { title: `${p.full_name} — Directorio audiovisual rural` },
        { name: "description", content: p.bio?.slice(0, 160) ?? `${p.primary_role ?? "Profesional del audiovisual"} en ${p.municipalities?.name ?? "España rural"}` },
        { property: "og:title", content: p.full_name },
        { property: "og:description", content: p.bio?.slice(0, 160) ?? "" },
        ...(p.photo_url ? [{ property: "og:image", content: p.photo_url }] : []),
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <p className="text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Perfil no encontrado</h1>
      <Link to="/directorio" className="text-primary hover:underline mt-4 inline-block">
        Volver al directorio
      </Link>
    </div>
  ),
  component: Profile,
});

function Profile() {
  const p = Route.useLoaderData() as any;
  const [filmModal, setFilmModal] = useState<any>(null);

  useEffect(() => {
    supabase.rpc("increment_profile_views", { _slug: p.slug } as any).then(() => {});
  }, [p.slug]);

  const munic = p.municipalities;
  const films = (p.filmography_items ?? []) as any[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex gap-4 items-start">
        <div className="flex-shrink-0">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-muted overflow-hidden border shadow-sm">
            {p.photo_url ? (
              <img src={p.photo_url} alt={p.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl md:text-2xl text-muted-foreground font-bold">
                {p.full_name.slice(0, 1)}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold">{p.full_name}</h1>
          {p.alias && <p className="text-sm text-muted-foreground italic">{p.alias}</p>}
          {p.primary_role && (
            <p className="mt-1 text-base md:text-lg font-medium text-primary">{p.primary_role}</p>
          )}
          {(munic || p.raw_postal_code || p.geo_municipality_name || p.geo_province) && (
            <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {p.raw_postal_code ? <span>CP {p.raw_postal_code}</span> : null}
              {(p.raw_postal_code && (munic || p.geo_municipality_name || p.geo_province)) ? (
                <span className="text-muted-foreground/60">·</span>
              ) : null}
              {munic ? (
                <span>
                  {munic.name}, {munic.province}
                  {munic.autonomous_community ? `, ${munic.autonomous_community}` : ""}
                </span>
              ) : (
                <span>
                  {[p.geo_municipality_name, p.geo_province].filter(Boolean).join(", ")}
                </span>
              )}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(p.secondary_roles ?? []).map((r: string) => (
              <span key={r} className="text-xs bg-secondary rounded-full px-2 py-0.5">
                {r}
              </span>
            ))}
            {(p.production_types ?? []).map((t: string) => (
              <span
                key={t}
                className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5"
              >
                {t}
              </span>
            ))}
          </div>

          {(p.email || p.website) && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <ContactDialog professionalId={p.id} professionalName={p.full_name} />
              {p.website && (
                <a
                  href={p.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Globe className="h-4 w-4" /> Web
                </a>
              )}
              {p.reel_url && (
                <a
                  href={p.reel_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Video className="h-4 w-4" /> Showreel
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        {p.bio && (
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.bio}</p>
          </div>
        )}

        {p.languages && p.languages.length > 0 && (
          <p className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
            <Languages className="h-4 w-4" /> {p.languages.join(", ")}
          </p>
        )}
      </div>


      {films.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold mb-4">Filmografía</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {films.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilmModal(f)}
                className="group text-left rounded-md overflow-hidden bg-muted"
              >
                <div className="aspect-[2/3] overflow-hidden">
                  {f.poster_url ? (
                    <img
                      src={f.poster_url}
                      alt={f.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-2 text-center">
                      {f.title}
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{f.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {f.year ?? ""} {f.role_in_production && `· ${f.role_in_production}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {(p.awards ?? []).length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Award className="h-5 w-5" /> Premios y reconocimientos
          </h2>
          <ul className="space-y-2 text-sm">
            {(p.awards as any[]).map((a, i) => (
              <li key={i} className="border-l-2 border-primary/40 pl-3">
                <span className="font-medium">{a.award}</span>
                {a.festival && <span className="text-muted-foreground"> · {a.festival}</span>}
                {a.year && <span className="text-muted-foreground"> · {a.year}</span>}
                {a.production && <div className="text-xs text-muted-foreground">{a.production}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(p.education ?? []).length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <GraduationCap className="h-5 w-5" /> Formación
          </h2>
          <ul className="space-y-2 text-sm">
            {(p.education as any[]).map((e, i) => (
              <li key={i}>
                <span className="font-medium">{e.degree}</span>
                {e.institution && <span className="text-muted-foreground"> · {e.institution}</span>}
                {e.year && <span className="text-muted-foreground"> · {e.year}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Film modal */}
      <Dialog open={!!filmModal} onOpenChange={(o) => !o && setFilmModal(null)}>
        <DialogContent className="max-w-2xl">
          {filmModal && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {filmModal.title}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({filmModal.year})
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="flex gap-4">
                {filmModal.poster_url && (
                  <img
                    src={filmModal.poster_url}
                    alt=""
                    className="w-32 h-auto rounded-md flex-shrink-0"
                  />
                )}
                <div className="text-sm space-y-2">
                  {filmModal.role_in_production && (
                    <p>
                      <span className="text-muted-foreground">Rol:</span>{" "}
                      <span className="font-medium">{filmModal.role_in_production}</span>
                    </p>
                  )}
                  {filmModal.synopsis && <p className="text-muted-foreground">{filmModal.synopsis}</p>}
                  {filmModal.tmdb_rating != null && (
                    <p className="text-xs">⭐ {Number(filmModal.tmdb_rating).toFixed(1)} en TMDB</p>
                  )}
                  {filmModal.custom_note && (
                    <p className="text-xs italic border-l-2 pl-2 mt-2">{filmModal.custom_note}</p>
                  )}
                  {filmModal.tmdb_id && (
                    <a
                      href={`https://www.themoviedb.org/${filmModal.type}/${filmModal.tmdb_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Ver en TMDB <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* references to unused imports to satisfy tree-shaker */}
      {false && <Mail />}
    </div>
  );
}
