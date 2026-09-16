import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/municipios")({
  component: MunicipiosAdmin,
});

function MunicipiosAdmin() {
  const [q, setQ] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [seedingCp, setSeedingCp] = useState(false);

  const countQ = useQuery({
    queryKey: ["mun-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("municipalities")
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const cpCountQ = useQuery({
    queryKey: ["mun-cp-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("municipalities")
        .select("*", { count: "exact", head: true })
        .not("postal_codes", "eq", "{}");
      return count ?? 0;
    },
  });

  const listQ = useQuery({
    queryKey: ["mun-list", q],
    queryFn: async () => {
      let query = supabase
        .from("municipalities")
        .select("code,name,province,autonomous_community,population,lat,lng,postal_codes")
        .order("population", { ascending: false })
        .limit(100);
      if (q) query = query.ilike("name", `%${q}%`);
      const { data } = await query;
      return data ?? [];
    },
  });

  // Los endpoints de carga exigen un token de administrador.
  async function adminFetch(url: string) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sesión caducada: vuelve a entrar");
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    return { r, j: await r.json() };
  }

  async function seed() {
    setSeeding(true);
    try {
      const { r, j } = await adminFetch("/api/public/seed-municipalities");
      if (r.ok) toast.success(`Cargados ${j.inserted ?? j.count ?? "?"} municipios`);
      else toast.error(j.error ?? "Error");
      countQ.refetch();
      listQ.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSeeding(false);
    }
  }

  async function seedPostalCodes() {
    setSeedingCp(true);
    try {
      const { r, j } = await adminFetch("/api/public/seed-postal-codes");
      if (r.ok) {
        toast.success(
          `Códigos postales cargados en ${j.rows_updated ?? 0} municipios (${j.postal_codes_assigned ?? 0} códigos, ${j.unmatched ?? 0} sin cruzar)`,
        );
      } else {
        toast.error(j.error ?? "Error");
      }
      cpCountQ.refetch();
      listQ.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSeedingCp(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Municipios</h1>
          <p className="text-sm text-muted-foreground">
            {countQ.data ?? "—"} municipios en la base de datos · {cpCountQ.data ?? "—"} con códigos
            postales
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={seed} disabled={seeding} variant="outline">
            {seeding ? "Cargando…" : "Cargar dataset INE"}
          </Button>
          <Button onClick={seedPostalCodes} disabled={seedingCp} variant="outline">
            {seedingCp ? "Cargando…" : "Cargar códigos postales"}
          </Button>
        </div>
      </div>

      <Input
        placeholder="Buscar municipio…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 max-w-sm"
      />

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left">
            <tr>
              <th className="p-2">Nombre</th>
              <th className="p-2">Provincia</th>
              <th className="p-2">CCAA</th>
              <th className="p-2 text-right">Habitantes</th>
              <th className="p-2 text-xs">Coord.</th>
              <th className="p-2 text-xs">Código</th>
            </tr>
          </thead>
          <tbody>
            {(listQ.data ?? []).map((m) => (
              <tr key={m.code} className="border-t">
                <td className="p-2 font-medium">{m.name}</td>
                <td className="p-2 text-muted-foreground">{m.province}</td>
                <td className="p-2 text-muted-foreground">{m.autonomous_community}</td>
                <td className="p-2 text-right">{m.population.toLocaleString("es-ES")}</td>
                <td className="p-2 text-xs text-muted-foreground">
                  {m.lat && m.lng ? `${m.lat.toFixed(3)}, ${m.lng.toFixed(3)}` : "—"}
                </td>
                <td className="p-2 text-xs text-muted-foreground font-mono">{m.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
