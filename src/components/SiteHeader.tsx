import { Link, useRouterState } from "@tanstack/react-router";
import { Film } from "lucide-react";

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = [
    { to: "/", label: "Inicio" },
    { to: "/directorio", label: "Directorio" },
    { to: "/mapa", label: "Mapa" },
    { to: "/admin", label: "Admin" },
  ] as const;
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Film className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">Directorio audiovisual rural</span>
          <span className="sm:hidden">DAR</span>
        </Link>
        <nav className="flex items-center gap-1 ml-auto text-sm">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                pathname === n.to || (n.to !== "/" && pathname.startsWith(n.to))
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
