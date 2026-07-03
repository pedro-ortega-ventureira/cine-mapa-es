import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { bucketFor, POPULATION_BUCKETS, SPAIN_BBOX, CANARIAS_BBOX, isCanarias } from "@/lib/constants";

export type MapPoint = {
  code: string;
  name: string;
  province: string;
  autonomous_community: string;
  population: number;
  lat: number | null;
  lng: number | null;
  professionals_count?: number;
};

type Props = {
  points: MapPoint[];
  onlyWithProfessionals?: boolean;
  onSelectMunicipality?: (code: string) => void;
};

const W = 800;
const H = 640;
const CANARIAS_W = 200;
const CANARIAS_H = 90;

function project(lat: number, lng: number, bbox: typeof SPAIN_BBOX, w: number, h: number) {
  const x = ((lng - bbox.minLng) / (bbox.maxLng - bbox.minLng)) * w;
  // invert lat (north up)
  const y = h - ((lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * h;
  return { x, y };
}

export function MunicipalityMap({ points, onlyWithProfessionals, onSelectMunicipality }: Props) {
  const [hover, setHover] = useState<MapPoint | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const filtered = useMemo(
    () =>
      points.filter(
        (p) =>
          p.lat != null &&
          p.lng != null &&
          p.population < 20000 &&
          (!onlyWithProfessionals || (p.professionals_count ?? 0) > 0),
      ),
    [points, onlyWithProfessionals],
  );

  const { mainland, canarias } = useMemo(() => {
    const mainland: MapPoint[] = [];
    const canarias: MapPoint[] = [];
    for (const p of filtered) {
      if (isCanarias(p.lat!, p.lng!)) canarias.push(p);
      else mainland.push(p);
    }
    return { mainland, canarias };
  }, [filtered]);

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto bg-[oklch(0.98_0.01_240)] rounded-lg border"
        role="img"
        aria-label="Mapa de municipios de España"
      >
        {/* Mainland + Baleares background */}
        <rect x={0} y={0} width={W} height={H} fill="transparent" />
        {mainland.map((p) => {
          const { x, y } = project(p.lat!, p.lng!, SPAIN_BBOX, W, H);
          const b = bucketFor(p.population);
          const hasPros = (p.professionals_count ?? 0) > 0;
          const r = hasPros ? 3 + Math.min(6, (p.professionals_count ?? 0)) : 1.4;
          return (
            <circle
              key={p.code}
              cx={x}
              cy={y}
              r={r}
              fill={b.color}
              fillOpacity={hasPros ? 0.95 : 0.55}
              stroke={hasPros ? "white" : "none"}
              strokeWidth={hasPros ? 0.8 : 0}
              onMouseEnter={(e) => {
                setHover(p);
                const rect = (e.target as SVGCircleElement).getBoundingClientRect();
                const parent = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHoverPos({ x: rect.left - parent.left + 8, y: rect.top - parent.top - 8 });
              }}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelectMunicipality?.(p.code)}
              style={{ cursor: onSelectMunicipality ? "pointer" : "default" }}
            />
          );
        })}
        {/* Canarias inset */}
        <g transform={`translate(20, ${H - CANARIAS_H - 20})`}>
          <rect
            x={-4}
            y={-4}
            width={CANARIAS_W + 8}
            height={CANARIAS_H + 8}
            fill="oklch(0.96 0.01 240)"
            stroke="oklch(0.85 0.02 240)"
            strokeDasharray="3 3"
            rx={6}
          />
          <text x={4} y={-8} fontSize={10} fill="oklch(0.4 0.02 240)">
            Canarias
          </text>
          {canarias.map((p) => {
            const { x, y } = project(p.lat!, p.lng!, CANARIAS_BBOX, CANARIAS_W, CANARIAS_H);
            const b = bucketFor(p.population);
            const hasPros = (p.professionals_count ?? 0) > 0;
            const r = hasPros ? 2.5 + Math.min(4, (p.professionals_count ?? 0)) : 1;
            return (
              <circle
                key={p.code}
                cx={x}
                cy={y}
                r={r}
                fill={b.color}
                fillOpacity={hasPros ? 0.95 : 0.55}
                stroke={hasPros ? "white" : "none"}
                strokeWidth={hasPros ? 0.6 : 0}
                onMouseEnter={() => setHover(p)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelectMunicipality?.(p.code)}
                style={{ cursor: onSelectMunicipality ? "pointer" : "default" }}
              />
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 bg-popover text-popover-foreground border rounded-md shadow-lg px-3 py-2 text-xs"
          style={{ left: hoverPos.x, top: hoverPos.y, transform: "translateY(-100%)" }}
        >
          <div className="font-semibold">{hover.name}</div>
          <div className="text-muted-foreground">
            {hover.province} · {hover.autonomous_community}
          </div>
          <div className="text-muted-foreground">
            {hover.population.toLocaleString("es-ES")} hab.
          </div>
          {(hover.professionals_count ?? 0) > 0 && (
            <div className="mt-1 text-primary font-medium">
              {hover.professionals_count} profesional
              {hover.professionals_count !== 1 ? "es" : ""}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Población:</span>
        {POPULATION_BUCKETS.map((b) => (
          <span key={b.label} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: b.color }}
            />
            {b.label}
          </span>
        ))}
        {hover && (
          <Link
            to="/municipios/$codigo"
            params={{ codigo: hover.code }}
            className="ml-auto text-primary hover:underline"
          >
            Ver municipio →
          </Link>
        )}
      </div>
    </div>
  );
}
