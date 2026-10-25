import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, ShieldCheck, Cookie } from "lucide-react";

const pages = [
  { to: "/aviso-legal" as const, label: "Aviso legal", icon: FileText },
  { to: "/privacidad" as const, label: "Privacidad", icon: ShieldCheck },
  { to: "/cookies" as const, label: "Cookies", icon: Cookie },
];

export function LegalLayout({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <main className="min-h-[70vh] bg-gradient-to-b from-secondary/30 via-background to-background px-4 py-10 md:py-16">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver al mapa
        </Link>
        <article className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-sm">
          <header className="border-b bg-primary/[0.06] px-6 py-8 md:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
            <div className="mt-5 flex flex-wrap gap-2">
              {pages.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 text-xs font-medium hover:border-primary/50 hover:text-primary">
                  <Icon className="h-3.5 w-3.5" /> {label}
                </Link>
              ))}
            </div>
          </header>
          <div className="px-6 py-8 md:px-10 md:py-10 legal-copy">{children}</div>
        </article>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-8 first:mt-0"><h2 className="text-lg font-semibold tracking-tight">{title}</h2><div className="mt-3 text-sm leading-7 text-muted-foreground">{children}</div></section>;
}
