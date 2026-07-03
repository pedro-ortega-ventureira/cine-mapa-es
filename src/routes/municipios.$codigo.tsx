import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ProfessionalCard } from "@/components/ProfessionalCard";
import { MapPin, Users } from "lucide-react";

export const Route = createFileRoute("/municipios/$codigo")({
  loader: async ({ params }) => {
    const [munRes, profRes] = await Promise.all([
      supabase.from("municipalities").select("*").eq("code", params.codigo).maybeSingle(),
      supabase
        .from("professionals")
        .select("id,slug,full_name,alias,photo_url,primary_role,production_types,municipality_code")
        .eq("verified", true)
        .eq("municipality_code", params.codigo),
    ]);
    if (!munRes.data) throw notFound();
    return { municipality: munRes.data, professionals: profRes.data ?? [] };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Municipio" }] };
    const m = loaderData.municipality as any;
    return {
      meta: [
        { title: `${m.name}, ${m.province} — Profesionales del audiovisual` },
        {
          name: "description",
          content: `Profesionales del audiovisual en ${m.name} (${m.province}, ${m.autonomous_community}). Población: ${m.population.toLocaleString("es-ES")} habitantes.`,
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Municipio no encontrado</h1>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
      {error.message}
    </div>
  ),
  component: MunicipalityPage,
});

function MunicipalityPage() {
  const { municipality: m, professionals } = Route.useLoaderData() as any;
  const enriched = professionals.map((p: any) => ({
    ...p,
    municipality: { name: m.name, province: m.province },
  }));
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/directorio" className="text-sm text-muted-foreground hover:text-foreground">
        ← Directorio
      </Link>
      <div className="mt-4 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">{m.name}</h1>
          <p className="text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="h-4 w-4" /> {m.province} · {m.autonomous_community}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Población: {m.population.toLocaleString("es-ES")} habitantes
          </p>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-semibold">{professionals.length}</span>
            <span className="text-sm text-muted-foreground">
              profesional{professionals.length !== 1 ? "es" : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-8">
        {enriched.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            Aún no hay profesionales registrados en este municipio.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {enriched.map((p: any) => (
              <ProfessionalCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
