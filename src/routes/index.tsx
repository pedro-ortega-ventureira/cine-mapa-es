import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { lazy, Suspense, useEffect, useState } from "react";
import { colorForRole } from "@/lib/roles";
import { Input } from "@/components/ui/input";
import { Search, Users, MapPin, Film } from "lucide-react";

const MunicipalitiesChoroplethMap = lazy(() =>
  import("@/components/MunicipalitiesChoroplethMap").then((m) => ({
    default: m.MunicipalitiesChoroplethMap,
  })),
);

export const Route = createFileRoute("/")({
  component: Home,
});

type OverlayRow = {
  code: string;
  professionals_count: number | null;
  verified_count: number | null;
};

function Home() {
  const [q, setQ] = useState("");
  const [onlyWithPros, setOnlyWithPros] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const overlaysQ = useQuery({
    queryKey: ["municipality_overlays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipality_stats" as any)
        .select("code,professionals_count,verified_count")
        .gt("professionals_count", 0)
        .limit(20000);
      if (error) throw error;
      return ((data ?? []) as unknown as OverlayRow[]).map((r) => ({
        code: r.code,
        professionals_count: r.professionals_count ?? 0,
        verified_count: r.verified_count ?? 0,
      }));
    },
  });

  const statsQ = useQuery({
    queryKey: ["home-stats"],
    queryFn: async () => {
      const [pros, muni] = await Promise.all([
        supabase.from("professionals").select("*", { count: "exact", head: true }).eq("verified", true),
        supabase.from("municipalities").select("*", { count: "exact", head: true }).lt("population", 20000),
      ]);
      return { professionals: pros.count ?? 0, municipalities: muni.count ?? 0 };
    },
  });

  const latestQ = useQuery({
    queryKey: ["latest-professionals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("professionals")
        .select("id,slug,full_name,alias,photo_url,primary_role,geo_municipality_name,geo_province")
        .eq("verified", true)
        .order("date_joined", { ascending: false })
        .limit(12);
      return data ?? [];
    },
  });

  const mapProsQ = useQuery({
    queryKey: ["verified-pros-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id,slug,full_name,primary_role,postal_code:raw_postal_code,geo_lat,geo_lng,geo_municipality_name,geo_province")
        .eq("verified", true)
        .eq("geo_accuracy", "exact")
        .not("geo_lat", "is", null)
        .not("geo_lng", "is", null)
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const overlays = overlaysQ.data ?? [];
  const mapPros = mapProsQ.data ?? [];



  return (
    <div>
      <section className="border-b bg-gradient-to-b from-secondary/40 to-background">
        <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
              <MapPin className="h-3 w-3" /> Municipios menores de 20.000 habitantes
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
              Directorio audiovisual rural
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Un mapa vivo de directoras, directores de fotografía, guionistas, técnicas y
              artistas que trabajan desde pueblos de toda España.
            </p>

            <form
              className="mt-6 flex gap-2 max-w-xl"
              onSubmit={(e) => {
                e.preventDefault();
                if (q.trim())
                  window.location.href = `/directorio?q=${encodeURIComponent(q.trim())}`;
              }}
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nombre, municipio o especialidad…"
                  className="pl-9"
                />
              </div>
              <Link
                to="/directorio"
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Explorar
              </Link>
            </form>

            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-semibold">{statsQ.data?.professionals ?? "—"}</span>
                <span className="text-muted-foreground">profesionales</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-semibold">{statsQ.data?.municipalities ?? "—"}</span>
                <span className="text-muted-foreground">municipios menores de 20.000 habitantes</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2">
                <Film className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Filmografía enlazada con TMDB</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Mapa de municipios</h2>
          <label className="text-xs text-muted-foreground inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyWithPros}
              onChange={(e) => setOnlyWithPros(e.target.checked)}
              className="rounded"
            />
            Ocultar municipios sin profesionales
          </label>

        </div>
        {!mounted ? (
          <div className="rounded-lg bg-muted animate-pulse" style={{ height: 480 }} />
        ) : (
          <Suspense
            fallback={<div className="rounded-lg bg-muted animate-pulse" style={{ height: 480 }} />}
          >
            <MunicipalitiesChoroplethMap
              overlays={overlays}
              professionals={mapPros}
              onlyWithProfessionals={onlyWithPros}
              onSelectMunicipality={(code: string) => {
                window.location.href = `/municipios/${code}`;
              }}
            />
          </Suspense>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Los puntos de color indican profesionales verificados según su código postal. Los círculos oscuros con número agrupan varios profesionales que comparten el mismo CP.
        </p>

      </section>

      {latestQ.data && latestQ.data.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8">
          <h2 className="text-lg font-semibold mb-4">Últimos perfiles añadidos</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {latestQ.data.map((p: any) => {
              const loc = [p.geo_municipality_name, p.geo_province].filter(Boolean).join(" / ");
              return (
                <li key={p.id}>
                  <Link
                    to="/profesionales/$slug"
                    params={{ slug: p.slug }}
                    className="group flex items-center gap-3 rounded-lg border bg-card p-2.5 hover:shadow-sm hover:border-primary/40 transition"
                  >
                    {p.photo_url ? (
                      <img
                        src={p.photo_url}
                        alt={p.full_name}
                        className="h-10 w-10 rounded-full object-cover border border-white shadow-sm shrink-0"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="h-4 w-4 rounded-full border-2 border-white shadow-sm shrink-0"
                        style={{ backgroundColor: colorForRole(p.primary_role) }}
                        title={p.primary_role ?? undefined}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight truncate">{p.full_name}</p>
                      {p.primary_role && (
                        <p className="text-xs truncate" style={{ color: colorForRole(p.primary_role) }}>
                          {p.primary_role}
                        </p>
                      )}
                      {loc && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          <MapPin className="inline h-3 w-3 -mt-0.5 mr-0.5" />
                          {loc}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
