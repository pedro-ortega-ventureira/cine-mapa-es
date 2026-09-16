import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Film, Menu, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [session, setSession] = useState<unknown | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setIsAdmin(false);
        return;
      }
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!cancelled) setIsAdmin(!error && data === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const nav = [
    { to: "/", label: "Inicio" },
    { to: "/directorio", label: "Directorio" },
    { to: "/mapa", label: "Mapa" },
    ...(isAdmin ? [{ to: "/admin", label: "Admin" }] : []),
  ] as const;
  const isActive = (to: string) => pathname === to || (to !== "/" && pathname.startsWith(to));
  const linkClass = (to: string) =>
    `px-3 py-1.5 rounded-md transition-colors ${
      isActive(to)
        ? "bg-secondary text-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
    }`;

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-6">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Film className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">Directorio audiovisual rural</span>
          <span className="sm:hidden">DAR</span>
        </Link>
        <nav className="ml-auto hidden items-center gap-1 text-sm sm:flex">
          {nav.map((item) => (
            <Link key={item.to} to={item.to} className={linkClass(item.to)}>
              {item.label}
            </Link>
          ))}
          <a
            href="https://españalatente.org"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          >
            España Latente
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <Link
            to="/registro"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <UserRound className="h-4 w-4" /> Mi ficha
          </Link>
          {!!session && (
            <button
              type="button"
              onClick={signOut}
              className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground sm:inline-flex"
            >
              Salir
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground sm:hidden"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {nav.map((item) => (
                <DropdownMenuItem key={item.to} asChild>
                  <Link to={item.to}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem asChild>
                <a href="https://españalatente.org" target="_blank" rel="noopener noreferrer">
                  España Latente
                </a>
              </DropdownMenuItem>
              {!!session && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void signOut()}>Salir</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
