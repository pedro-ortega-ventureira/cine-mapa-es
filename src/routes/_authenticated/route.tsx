import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Home, Users, Upload, MapPin, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // No basta con estar logueado: cualquier profesional registrado vía
    // /registro tiene sesión pero no rol admin. Sin esta comprobación, si
    // esos usuarios pulsan "Admin" en el menú, las queries admin-only de las
    // páginas hijas fallan sin que ningún error boundary las capture y la
    // app se queda en blanco (visto como error de hidratación #419).
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "admin",
    });
    return { user: data.user, isAdmin: !!isAdmin };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { isAdmin } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-3">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold">Acceso restringido</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Tu cuenta ha iniciado sesión correctamente, pero no tiene permisos de administrador
          para ver esta sección.
        </p>
        <div className="flex justify-center gap-2 mt-6">
          <Button variant="outline" onClick={() => navigate({ to: "/" })}>
            Ir al inicio
          </Button>
          <Button variant="ghost" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  const nav: Array<{ to: "/admin" | "/admin/profesionales" | "/admin/importar" | "/admin/municipios"; label: string; icon: any; exact?: boolean }> = [
    { to: "/admin", label: "Dashboard", icon: Home, exact: true },
    { to: "/admin/profesionales", label: "Profesionales", icon: Users },
    { to: "/admin/importar", label: "Importar Excel", icon: Upload },
    { to: "/admin/municipios", label: "Municipios", icon: MapPin },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex gap-6">
        <aside className="w-56 flex-shrink-0 space-y-1">
          {nav.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  active ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <Icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
          <div className="pt-4 mt-4 border-t">
            <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start">
              <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
            </Button>
          </div>
        </aside>
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
