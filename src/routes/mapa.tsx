import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, ShieldCheck, HelpCircle } from "lucide-react";

const ProfessionalsLeafletMap = lazy(() =>
  import("@/components/ProfessionalsLeafletMap").then((m) => ({
    default: m.ProfessionalsLeafletMap,
  })),
);

export const Route = createFileRoute("/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa de profesionales — Directorio audiovisual rural" },
      {
        name: "description",
        content:
          "Mapa interactivo con los profesionales del audiovisual radicados en municipios rurales de España, agrupados por proximidad.",
      },
      { property: "og:title", content: "Mapa de profesionales del audiovisual rural" },
      {
        property: "og:description",
        content:
          "Explora en el mapa a los profesionales del audiovisual que viven y trabajan en municipios rurales de España.",
      },
    ],
  }),
  component: MapPage,
});

type Row = {
  id: string;
  slug: string;
  full_name: string;
  alias: string | null;
  photo_url: string | null;
  primary_role: string | null;
  verified: boolean;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_accuracy: "exact" | "province" | "none" | null;
  geo_municipality_name: string | null;
  geo_province: string | null;
};

function MapPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [hideApprox, setHideApprox] = useState(false);

  const q = useQuery({
    queryKey: ["map-professionals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select(
          "id,slug,full_name,alias,photo_url,primary_role,verified,geo_lat,geo_lng,geo_accuracy,geo_municipality_name,geo_province",
        )
        .eq("verified", true)
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const all = q.data ?? [];
  const geolocated = useMemo(
    () => all.filter((r) => r.geo_lat != null && r.geo_lng != null && r.geo_accuracy && r.geo_accuracy !== "none"),
    [all],
  );
  const exact = geolocated.filter((r) => r.geo_accuracy === "exact");
  const approx = geolocated.filter((r) => r.geo_accuracy === "province");
  const pending = all.length - geolocated.length;

  const visible = useMemo(() => {
    return geolocated
      .filter((r) => (onlyVerified ? r.verified : true))
      .filter((r) => (hideApprox ? r.geo_accuracy === "exact" : true))
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        full_name: r.full_name,
        alias: r.alias,
        photo_url: r.photo_url,
        primary_role: r.primary_role,
        verified: r.verified,
        geo_lat: r.geo_lat as number,
        geo_lng: r.geo_lng as number,
        geo_accuracy: r.geo_accuracy as "exact" | "province",
        geo_municipality_name: r.geo_municipality_name,
        geo_province: r.geo_province,
      }));
  }, [geolocated, onlyVerified, hideApprox]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Mapa de profesionales</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cada punto es una persona. Los grupos se abren al hacer zoom.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 cursor-pointer bg-card">
            <input
              type="checkbox"
              checked={onlyVerified}
              onChange={(e) => setOnlyVerified(e.target.checked)}
            />
            Solo verificados
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 cursor-pointer bg-card">
            <input
              type="checkbox"
              checked={hideApprox}
              onChange={(e) => setHideApprox(e.target.checked)}
            />
            Ocultar aproximados
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-sm">
        <Stat icon={<MapPin className="h-4 w-4 text-primary" />} label="Geolocalizados" value={exact.length} />
        <Stat icon={<HelpCircle className="h-4 w-4 text-amber-600" />} label="Aproximados (provincia)" value={approx.length} />
        <Stat icon={<HelpCircle className="h-4 w-4 text-muted-foreground" />} label="Sin geolocalizar" value={pending} />
        <Stat icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />} label="Total mostrados" value={visible.length} />
      </div>

      {q.isLoading || !mounted ? (
        <div className="rounded-lg border bg-muted animate-pulse" style={{ height: 480 }} />
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no hay profesionales geolocalizados. Un administrador puede pulsar
          "Resolver geolocalización" en el panel de profesionales.
        </div>
      ) : (
        <Suspense
          fallback={<div className="rounded-lg border bg-muted animate-pulse" style={{ height: 480 }} />}
        >
          <ProfessionalsLeafletMap professionals={visible} />
        </Suspense>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-[#2A81CB]" /> Ubicación exacta
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-gray-400 border border-white" /> Aproximada (centroide de provincia)
        </span>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2">
      {icon}
      <span className="font-semibold">{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}
