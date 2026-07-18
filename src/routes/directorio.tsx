import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { lazy, Suspense, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ProfessionalCard } from "@/components/ProfessionalCard";
import { AUTONOMOUS_COMMUNITIES, PRIMARY_ROLES, PRODUCTION_TYPES } from "@/lib/constants";
import { buildMunIndex, parseQuery, normalize } from "@/lib/search";
import { Search, Grid3x3, List, X, Map as MapIcon, ChevronUp } from "lucide-react";
import type { MapProfessional } from "@/components/ProfessionalsLeafletMap";
import { z } from "zod";

const ProfessionalsLeafletMap = lazy(() =>
  import("@/components/ProfessionalsLeafletMap").then((m) => ({ default: m.ProfessionalsLeafletMap })),
);

const searchSchema = z.object({
  q: z.string().optional(),
  ccaa: z.string().optional(),
  provincia: z.string().optional(),
  rol: z.string().optional(),
  tipo: z.string().optional(),
});

export const Route = createFileRoute("/directorio")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Directorio de profesionales — Audiovisual rural" },
      {
        name: "description",
        content:
          "Explora el listado completo de profesionales del audiovisual afincados en municipios rurales de España.",
      },
    ],
  }),
  component: Directorio,
});

const sel = (s: string): string => s;

function Directorio() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState(search.q ?? "");
  const [mapOpen, setMapOpen] = useState(true);

  const municipalitiesQ = useQuery({
    queryKey: ["municipalities-lite-v2"],
    queryFn: async () => {
      const { data } = await supabase
        .from("municipalities")
        .select("code,name,province,autonomous_community")
        .limit(20000);
      return (data ?? []) as Array<{
        code: string;
        name: string;
        province: string;
        autonomous_community: string | null;
      }>;
    },
    staleTime: 5 * 60_000,
  });

  const munMap = useMemo(() => {
    const m = new Map<string, { name: string; province: string; ccaa: string | null }>();
    for (const r of municipalitiesQ.data ?? [])
      m.set(r.code, { name: r.name, province: r.province, ccaa: r.autonomous_community });
    return m;
  }, [municipalitiesQ.data]);

  const munIndex = useMemo(
    () => buildMunIndex(municipalitiesQ.data ?? []),
    [municipalitiesQ.data],
  );

  const parsed = useMemo(() => parseQuery(search.q ?? "", munIndex), [search.q, munIndex]);

  const profsQ = useQuery({
    queryKey: ["professionals-v3", search, parsed],
    queryFn: async () => {
      const effectiveRoles = search.rol ? [search.rol] : parsed.roles.map((r) => r.canonical);
      const effectiveCcaa = search.ccaa ? [search.ccaa] : parsed.ccaa.map((c) => c.display);
      const effectiveProvinces = search.provincia
        ? [search.provincia]
        : parsed.provinces.map((p) => p.display);

      let codeSet: Set<string> | null = null;
      if (effectiveProvinces.length || effectiveCcaa.length || parsed.municipalities.length) {
        codeSet = new Set<string>();
        for (const p of effectiveProvinces) {
          for (const c of munIndex.provinceToCodes.get(normalize(p)) ?? []) codeSet.add(c);
        }
        for (const c of effectiveCcaa) {
          for (const code of munIndex.ccaaToCodes.get(normalize(c)) ?? []) codeSet.add(code);
        }
        for (const m of parsed.municipalities) codeSet.add(m.code);
      }

      let query = supabase
        .from("professionals")
        .select(
          sel(
            "id,slug,full_name,alias,photo_url,primary_role,secondary_roles,production_types,municipality_code,tags,verified,geo_lat,geo_lng,geo_accuracy,geo_municipality_name,geo_province",
          ),
        )
        .eq("verified", true)
        .order("date_joined", { ascending: false })
        .limit(500);

      if (effectiveRoles.length === 1) {
        query = query.ilike("primary_role", `%${effectiveRoles[0]}%`);
      } else if (effectiveRoles.length > 1) {
        const orExpr = effectiveRoles.map((r) => `primary_role.ilike.%${r}%`).join(",");
        query = query.or(orExpr);
      }

      if (search.tipo) query = query.contains("production_types", [search.tipo]);

      if (codeSet && codeSet.size) {
        const codes = [...codeSet];
        if (codes.length <= 800) {
          query = query.in("municipality_code", codes);
        }
      }

      const { data, error } = await query.returns<any[]>();
      if (error) throw error;
      let rows = data ?? [];

      if (codeSet && codeSet.size > 800) {
        rows = rows.filter((r: any) => r.municipality_code && codeSet!.has(r.municipality_code));
      }

      if (parsed.freeText) {
        const tokens = parsed.freeText.split(/\s+/).filter(Boolean);
        rows = rows.filter((r: any) => {
          const hay = normalize(
            [
              r.full_name ?? "",
              r.alias ?? "",
              r.primary_role ?? "",
              (r.secondary_roles ?? []).join(" "),
              (r.tags ?? []).join(" "),
            ].join(" "),
          );
          return tokens.every((t) => hay.includes(t));
        });
      }

      return rows;
    },
  });

  const enriched = (profsQ.data ?? []).map((p: any) => ({
    ...p,
    municipality: p.municipality_code ? munMap.get(p.municipality_code) ?? null : null,
  }));

  const mapProfessionals: MapProfessional[] = useMemo(
    () =>
      enriched
        .filter(
          (p: any) =>
            typeof p.geo_lat === "number" &&
            typeof p.geo_lng === "number" &&
            !Number.isNaN(p.geo_lat) &&
            !Number.isNaN(p.geo_lng),
        )
        .map((p: any) => ({
          id: p.id,
          slug: p.slug,
          full_name: p.full_name,
          alias: p.alias,
          photo_url: p.photo_url,
          primary_role: p.primary_role,
          verified: !!p.verified,
          geo_lat: p.geo_lat,
          geo_lng: p.geo_lng,
          geo_accuracy: (p.geo_accuracy === "province" ? "province" : "exact") as
            | "exact"
            | "province",
          geo_municipality_name: p.geo_municipality_name ?? p.municipality?.name ?? null,
          geo_province: p.geo_province ?? p.municipality?.province ?? null,
        })),
    [enriched],
  );

  const removeToken = (phrase: string) => {
    const cur = search.q ?? "";
    const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const next = cur.replace(re, "").replace(/\s+/g, " ").trim();
    setQ(next);
    navigate({ search: { ...search, q: next || undefined } });
  };

  const chips: Array<{ label: string; phrase: string }> = [
    ...parsed.roles.map((r) => ({ label: `Rol: ${r.canonical}`, phrase: r.phrase })),
    ...parsed.provinces.map((p) => ({ label: `Provincia: ${p.display}`, phrase: p.phrase })),
    ...parsed.ccaa.map((c) => ({ label: `CCAA: ${c.display}`, phrase: c.phrase })),
  ];

  const hasAnyFilter =
    !!search.q || !!search.ccaa || !!search.rol || !!search.tipo || !!search.provincia;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Filters */}
        <aside className="md:w-64 space-y-4 md:sticky md:top-20 md:self-start">
          <div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                navigate({ search: { ...search, q: q || undefined } });
              }}
              className="relative"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, rol, provincia…"
                className="pl-9"
              />
            </form>
            {chips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {chips.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => removeToken(c.phrase)}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] hover:bg-secondary/70"
                  >
                    {c.label}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <FilterSelect
            label="Comunidad Autónoma"
            value={search.ccaa ?? ""}
            options={AUTONOMOUS_COMMUNITIES}
            onChange={(v) => navigate({ search: { ...search, ccaa: v || undefined } })}
          />
          <FilterSelect
            label="Rol principal"
            value={search.rol ?? ""}
            options={PRIMARY_ROLES}
            onChange={(v) => navigate({ search: { ...search, rol: v || undefined } })}
          />
          <FilterSelect
            label="Tipo de producción"
            value={search.tipo ?? ""}
            options={PRODUCTION_TYPES}
            onChange={(v) => navigate({ search: { ...search, tipo: v || undefined } })}
          />

          {hasAnyFilter && (
            <Link
              to="/directorio"
              search={{}}
              className="text-xs text-primary hover:underline"
              onClick={() => setQ("")}
            >
              Limpiar filtros
            </Link>
          )}
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h1 className="text-2xl font-semibold">
              Directorio
              <span className="ml-2 text-sm text-muted-foreground font-normal">
                {enriched.length} resultado{enriched.length !== 1 ? "s" : ""}
              </span>
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMapOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-xs border rounded-md px-2 py-1 hover:bg-accent"
                aria-expanded={mapOpen}
              >
                {mapOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <MapIcon className="h-3.5 w-3.5" />}
                {mapOpen ? "Ocultar mapa" : "Mostrar mapa"}
              </button>
              <div className="flex items-center gap-1 border rounded-md p-0.5">
                <button
                  onClick={() => setView("grid")}
                  aria-label="Vista de tarjetas"
                  className={`p-1.5 rounded ${view === "grid" ? "bg-secondary" : ""}`}
                >
                  <Grid3x3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setView("list")}
                  aria-label="Vista de lista"
                  className={`p-1.5 rounded ${view === "list" ? "bg-secondary" : ""}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {mapOpen && (
            <div className="mb-6">
              <Suspense
                fallback={
                  <div
                    className="w-full rounded-lg border bg-muted animate-pulse"
                    style={{ height: "min(50vh, 460px)", minHeight: 320 }}
                  />
                }
              >
                <ProfessionalsLeafletMap professionals={mapProfessionals} />
              </Suspense>
              {mapProfessionals.length === 0 && !profsQ.isLoading && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Ningún profesional con localización coincide con los filtros.
                </p>
              )}
            </div>
          )}

          {profsQ.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : enriched.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              No hay profesionales que coincidan con los filtros.
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {enriched.map((p: any) => (
                <ProfessionalCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border divide-y">
              {enriched.map((p: any) => (
                <Link
                  key={p.id}
                  to="/profesionales/$slug"
                  params={{ slug: p.slug }}
                  className="flex items-center gap-3 p-3 hover:bg-accent/50"
                >
                  <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex-shrink-0">
                    {p.photo_url && (
                      <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.primary_role ?? "—"} {p.municipality && `· ${p.municipality.name}`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
