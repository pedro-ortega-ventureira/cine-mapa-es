import { Link } from "@tanstack/react-router";
import { MapPin, User } from "lucide-react";

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
  return (
    <Link
      to="/profesionales/$slug"
      params={{ slug: p.slug }}
      className="group block rounded-lg border bg-card hover:shadow-md transition-shadow overflow-hidden"
    >
      <div className="aspect-[4/5] bg-muted flex items-center justify-center overflow-hidden">
        {p.photo_url ? (
          <img
            src={p.photo_url}
            alt={p.full_name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <User className="h-16 w-16 text-muted-foreground" strokeWidth={1} />
        )}
      </div>
      <div className="p-3 space-y-1">
        <h3 className="font-semibold text-sm leading-tight">{p.full_name}</h3>
        {p.alias && <p className="text-xs text-muted-foreground">{p.alias}</p>}
        {p.primary_role && (
          <p className="text-xs text-primary/90 font-medium">{p.primary_role}</p>
        )}
        {p.municipality && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {p.municipality.name}, {p.municipality.province}
          </p>
        )}
      </div>
    </Link>
  );
}
