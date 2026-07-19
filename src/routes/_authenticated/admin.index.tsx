import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, MapPin, CheckCircle2, Clock } from "lucide-react";
import { Route as ParentRoute } from "./route";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function Dashboard() {
  const ctx = ParentRoute.useRouteContext();
  const isAdminQ = useQuery({
    queryKey: ["has-role-admin", ctx.user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: ctx.user!.id, _role: "admin" } as any);
      return !!data;
    },
    enabled: !!ctx.user?.id,
  });

  const statsQ = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      // "id" en vez de "*": el rol autenticado solo tiene permiso de lectura
      // sobre columnas concretas de `professionals` (no la tabla entera), y
      // pedir "*" falla en silencio dejando los contadores a 0.
      const [total, verified, muniCount] = await Promise.all([
        supabase.from("professionals").select("id", { count: "exact", head: true }),
        supabase.from("professionals").select("id", { count: "exact", head: true }).eq("verified", true),
        supabase.from("municipalities").select("code", { count: "exact", head: true }),
      ]);
      if (total.error) throw total.error;
      if (verified.error) throw verified.error;
      if (muniCount.error) throw muniCount.error;
      return {
        total: total.count ?? 0,
        verified: verified.count ?? 0,
        pending: (total.count ?? 0) - (verified.count ?? 0),
        municipalities: muniCount.count ?? 0,
      };
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Panel de administración</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Signed in as {ctx.user?.email}
        {isAdminQ.data === false && (
          <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
            Aún no eres admin — ejecuta el SQL de promoción
          </span>
        )}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Profesionales totales" value={statsQ.data?.total ?? "—"} icon={Users} />
        <StatCard label="Verificados" value={statsQ.data?.verified ?? "—"} icon={CheckCircle2} />
        <StatCard label="Pendientes" value={statsQ.data?.pending ?? "—"} icon={Clock} />
        <StatCard label="Municipios" value={statsQ.data?.municipalities ?? "—"} icon={MapPin} />
      </div>

      {isAdminQ.data === false && (
        <div className="mt-8 rounded-lg border p-4 bg-yellow-50 text-sm">
          <p className="font-semibold mb-2">Convierte esta cuenta en administrador</p>
          <p className="text-muted-foreground mb-2">
            Ejecuta esta consulta SQL una sola vez (desde la consola de la base de datos):
          </p>
          <pre className="bg-background border rounded p-2 text-xs overflow-x-auto">
{`INSERT INTO public.user_roles (user_id, role)
VALUES ('${ctx.user?.id}', 'admin');`}
          </pre>
        </div>
      )}
    </div>
  );
}
