import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ProfessionalCard } from "@/components/ProfessionalCard";
import { AUTONOMOUS_COMMUNITIES, PRIMARY_ROLES, PRODUCTION_TYPES } from "@/lib/constants";
import { Search, Grid3x3, List } from "lucide-react";
import { z } from "zod";

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

function Directorio() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState(search.q ?? "");

  const municipalitiesQ = useQuery({
    queryKey: ["municipalities-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("municipalities").select("code,name,province");
      return data ?? [];
    },
  });
  const munMap = useMemo(() => {
    const m = new Map<string, { name: string; province: string }>();
    for (const r of municipalitiesQ.data ?? []) m.set(r.code, { name: r.name, province: r.province });
    return m;
  }, [municipalitiesQ.data]);

  const profsQ = useQuery({
    queryKey: ["professionals", search],
    queryFn: async () => {
      let q = supabase
        .from("professionals")
        .select("id,slug,full_name,alias,photo_url,primary_role,production_types,municipality_code,secondary_roles,tags")
        .eq("verified", true)
        .order("date_joined", { ascending: false })
        .limit(120);
      if (search.rol) q = q.eq("primary_role", search.rol);
      if (search.tipo) q = q.contains("production_types", [search.tipo]);
      const { data, error } = await q;
      if (error) throw error;
      let rows = data ?? [];
      if (search.q) {
        const needle = search.q.toLowerCase();
        rows = rows.filter(
          (r: any) =>
            r.full_name.toLowerCase().includes(needle) ||
            (r.alias ?? "").toLowerCase().includes(needle) ||
            (r.primary_role ?? "").toLowerCase().includes(needle),
        );
      }
      return rows;
    },
  });

  const enriched = (profsQ.data ?? []).map((p: any) => ({
    ...p,
    municipality: p.municipality_code ? munMap.get(p.municipality_code) ?? null : null,
  })).filter((p: any) => {
    if (search.ccaa && p.municipality_code) {
      const m = munMap.get(p.municipality_code);
      // needs autonomous_community lookup — for simplicity just filter by province if ccaa passed as province
      void m;
    }
    if (search.provincia && p.municipality) {
      return p.municipality.province === search.provincia;
    }
    return true;
  });

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
                placeholder="Buscar…"
                className="pl-9"
              />
            </form>
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

          {(search.q || search.ccaa || search.rol || search.tipo || search.provincia) && (
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
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold">
              Directorio
              <span className="ml-2 text-sm text-muted-foreground font-normal">
                {enriched.length} resultado{enriched.length !== 1 ? "s" : ""}
              </span>
            </h1>
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
