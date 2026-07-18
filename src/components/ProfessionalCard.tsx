import { Link } from "@tanstack/react-router";
import { MapPin, User } from "lucide-react";
import { colorForRole } from "@/lib/roles";

type Professional = {
  id: string;
  slug: string;
  full_name: string;
  alias: string | null;
  photo_url: string | null;
  primary_role: string | null;
  production_types: string[] | null;
  municipality_code: string | null;
  municipality?: { name: string; province: string } | null;
};

export function ProfessionalCard({ p }: { p: Professional }) {
  const roleColor = colorForRole(p.primary_role);
  return (
    <Link
      to="/profesionales/$slug"
      params={{ slug: p.slug }}
      className="group flex items-center gap-3 rounded-lg border bg-card p-3 hover:shadow-sm hover:border-primary/40 transition"
    >
      {p.photo_url ? (
        <img
          src={p.photo_url}
          alt={p.full_name}
          loading="lazy"
          className="h-10 w-10 rounded-full object-cover border border-white shadow-sm shrink-0"
        />
      ) : (
        <span
          aria-hidden
          className="h-10 w-10 rounded-full border border-white shadow-sm shrink-0 flex items-center justify-center"
          style={{ backgroundColor: roleColor }}
        >
          <User className="h-5 w-5 text-white" strokeWidth={1.5} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-sm leading-tight truncate">{p.full_name}</h3>
        {p.alias && <p className="text-xs text-muted-foreground truncate">{p.alias}</p>}
        {p.primary_role && (
          <p className="text-xs font-medium truncate" style={{ color: roleColor }}>
            {p.primary_role}
          </p>
        )}
        {p.municipality && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 shrink-0" />
            {p.municipality.name}, {p.municipality.province}
          </p>
        )}
      </div>
    </Link>
  );
}
