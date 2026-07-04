import React, { useMemo, useState } from "react";
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
  verified_count?: number;
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

function bufferRadius(count: number) {
  // 1 pro → 7px, scales up to ~20px
  return Math.min(22, 7 + Math.sqrt(count) * 4);
}
function dotRadius(count: number) {
  return Math.min(7, 2.5 + Math.sqrt(count));
}

export function MunicipalityMap({ points, onlyWithProfessionals, onSelectMunicipality }: Props) {
  const [hover, setHover] = useState<MapPoint | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const geoPoints = useMemo(
    () => points.filter((p) => p.lat != null && p.lng != null && p.population < 20000),
    [points],
  );

  const { baseMainland, baseCanarias, activeMainland, activeCanarias } = useMemo(() => {
    const baseMainland: MapPoint[] = [];
    const baseCanarias: MapPoint[] = [];
    const activeMainland: MapPoint[] = [];
    const activeCanarias: MapPoint[] = [];
    for (const p of geoPoints) {
      const active = (p.professionals_count ?? 0) > 0;
      if (isCanarias(p.lat!, p.lng!)) {
        if (active) activeCanarias.push(p);
        else if (!onlyWithProfessionals) baseCanarias.push(p);
      } else {
        if (active) activeMainland.push(p);
        else if (!onlyWithProfessionals) baseMainland.push(p);
      }
    }
    return { baseMainland, baseCanarias, activeMainland, activeCanarias };
  }, [geoPoints, onlyWithProfessionals]);

  const renderPoint = (
    p: MapPoint,
    bbox: typeof SPAIN_BBOX,
    w: number,
    h: number,
    variant: "base" | "active",
  ) => {
    const { x, y } = project(p.lat!, p.lng!, bbox, w, h);
    const b = bucketFor(p.population);
    const count = p.professionals_count ?? 0;
    const handlers = {
      onMouseEnter: (e: React.MouseEvent<SVGElement>) => {
        setHover(p);
        const rect = (e.currentTarget as SVGGraphicsElement).getBoundingClientRect();
        const parent = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
        setHoverPos({ x: rect.left - parent.left + 8, y: rect.top - parent.top - 8 });
      },
      onMouseLeave: () => setHover(null),
      onClick: () => onSelectMunicipality?.(p.code),
      style: { cursor: onSelectMunicipality ? "pointer" : "default" as const },
    };

    if (variant === "base") {
      return (
        <circle
          key={p.code}
          cx={x}
          cy={y}
          r={1.3}
          fill={b.color}
          fillOpacity={0.45}
          {...handlers}
        />
      );
    }
    // active: buffer halo + solid dot
    const rBuf = bufferRadius(count);
    const rDot = dotRadius(count);
    return (
      <g key={p.code} {...handlers}>
        <circle cx={x} cy={y} r={rBuf} fill={b.color} fillOpacity={0.18} />
        <circle cx={x} cy={y} r={rBuf * 0.55} fill={b.color} fillOpacity={0.28} />
        <circle
          cx={x}
          cy={y}
          r={rDot}
          fill={b.color}
          stroke="white"
          strokeWidth={1}
          fillOpacity={1}
        />
      </g>
    );
  };

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto bg-[oklch(0.98_0.01_240)] rounded-lg border"
        role="img"
        aria-label="Mapa de municipios de España"
      >
        <rect x={0} y={0} width={W} height={H} fill="transparent" />
        {/* Base layer (dim dots) */}
        <g>{baseMainland.map((p) => renderPoint(p, SPAIN_BBOX, W, H, "base"))}</g>
        {/* Active layer (halo + dot) on top */}
        <g>{activeMainland.map((p) => renderPoint(p, SPAIN_BBOX, W, H, "active"))}</g>

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
          {baseCanarias.map((p) => renderPoint(p, CANARIAS_BBOX, CANARIAS_W, CANARIAS_H, "base"))}
          {activeCanarias.map((p) => renderPoint(p, CANARIAS_BBOX, CANARIAS_W, CANARIAS_H, "active"))}
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
              {typeof hover.verified_count === "number" &&
                hover.verified_count !== hover.professionals_count && (
                  <span className="text-muted-foreground font-normal">
                    {" "}· {hover.verified_count} verificado
                    {hover.verified_count !== 1 ? "s" : ""}
                  </span>
                )}
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
