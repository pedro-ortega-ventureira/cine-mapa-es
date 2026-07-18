import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { POPULATION_BUCKETS, colorForPopulation } from "@/lib/constants";

export type ChoroplethOverlay = {
  code: string; // codigo_ine
  professionals_count: number;
  verified_count?: number;
};

type Props = {
  overlays?: ChoroplethOverlay[];
  onlyWithProfessionals?: boolean;
  onSelectMunicipality?: (codigo_ine: string) => void;
  height?: number | string;
};

const GEOJSON_URL = "/geo/municipios-lt20k.geojson";

let cachedGeo: GeoJSON.FeatureCollection | null = null;
let cachedPromise: Promise<GeoJSON.FeatureCollection> | null = null;
function loadMunicipalities(): Promise<GeoJSON.FeatureCollection> {
  if (cachedGeo) return Promise.resolve(cachedGeo);
  if (cachedPromise) return cachedPromise;
  cachedPromise = fetch(GEOJSON_URL)
    .then((r) => r.json())
    .then((j: GeoJSON.FeatureCollection) => {
      cachedGeo = j;
      return j;
    });
  return cachedPromise;
}

export function MunicipalitiesChoroplethMap({
  overlays,
  onlyWithProfessionals,
  onSelectMunicipality,
  height = "min(72vh, 640px)",
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);

  const overlayMap = useMemo(() => {
    const m = new Map<string, ChoroplethOverlay>();
    for (const o of overlays ?? []) m.set(o.code, o);
    return m;
  }, [overlays]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [39.5, -3.7],
      zoom: 5,
      minZoom: 4,
      preferCanvas: true,
      worldCopyJump: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    map.fitBounds(
      L.latLngBounds(L.latLng(27.5, -18.5), L.latLng(44.0, 4.5)),
      { animate: false, padding: [8, 8] },
    );
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Load + render polygons; re-run when filter/overlays change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    loadMunicipalities().then((geo) => {
      if (cancelled || !mapRef.current) return;
      if (layerRef.current) {
        layerRef.current.remove();
        layerRef.current = null;
      }

      const filtered: GeoJSON.FeatureCollection = onlyWithProfessionals
        ? {
            type: "FeatureCollection",
            features: geo.features.filter((f) => {
              const code = (f.properties as any)?.codigo_ine as string | undefined;
              return code ? (overlayMap.get(code)?.professionals_count ?? 0) > 0 : false;
            }),
          }
        : geo;

      const layer = L.geoJSON(filtered, {
        style: (feature) => {
          const props = feature?.properties as any;
          const pop = Number(props?.habitantes ?? 0);
          const code = props?.codigo_ine as string | undefined;
          const has = code ? (overlayMap.get(code)?.professionals_count ?? 0) > 0 : false;
          return {
            color: has ? "#0f172a" : "#94a3b8",
            weight: has ? 1.1 : 0.35,
            opacity: has ? 0.9 : 0.55,
            fillColor: colorForPopulation(pop),
            fillOpacity: has ? 0.85 : 0.55,
          };
        },
        onEachFeature: (feature, lyr) => {
          const props = feature.properties as any;
          const code = props?.codigo_ine as string;
          const name = props?.municipio as string;
          const prov = props?.provincia as string;
          const pop = Number(props?.habitantes ?? 0);
          const ov = overlayMap.get(code);
          const proText =
            ov && ov.professionals_count > 0
              ? `<div style="margin-top:4px;color:#2563eb;font-weight:600">${ov.professionals_count} profesional${ov.professionals_count !== 1 ? "es" : ""}${
                  typeof ov.verified_count === "number" && ov.verified_count !== ov.professionals_count
                    ? ` · ${ov.verified_count} verif.`
                    : ""
                }</div>`
              : "";
          lyr.bindTooltip(
            `<div style="font-family:system-ui;line-height:1.35">
              <div style="font-weight:600">${escapeHtml(name)}</div>
              <div style="font-size:11px;color:#64748b">${escapeHtml(prov)}</div>
              <div style="font-size:11px;color:#64748b">${pop.toLocaleString("es-ES")} hab.</div>
              ${proText}
            </div>`,
            { sticky: true, direction: "top", opacity: 0.95 },
          );
          if (onSelectMunicipality) {
            lyr.on("click", () => onSelectMunicipality(code));
          }
          lyr.on("mouseover", (e) => {
            (e.target as L.Path).setStyle({ weight: 2, color: "#0f172a" });
          });
          lyr.on("mouseout", (e) => {
            layer.resetStyle(e.target as L.Path);
          });
        },
      });
      layer.addTo(mapRef.current);
      layerRef.current = layer;
    });

    return () => {
      cancelled = true;
    };
  }, [overlayMap, onlyWithProfessionals, onSelectMunicipality]);

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="w-full rounded-lg border overflow-hidden"
        style={{ height, minHeight: 380 }}
        role="region"
        aria-label="Mapa coroplético de municipios de España menores de 20.000 habitantes"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Población (menor = más intenso):</span>
        {POPULATION_BUCKETS.map((b) => (
          <span key={b.label} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm border border-black/10"
              style={{ backgroundColor: b.color }}
            />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}
