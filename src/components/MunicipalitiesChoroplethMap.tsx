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

// Bounds
const PENINSULA_BOUNDS = L.latLngBounds(L.latLng(35.8, -9.8), L.latLng(44.0, 4.6));
const CANARIAS_BOUNDS = L.latLngBounds(L.latLng(27.4, -18.4), L.latLng(29.5, -13.3));

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

function isCanarias(feature: GeoJSON.Feature): boolean {
  const prov = String((feature.properties as any)?.provincia ?? "").toLowerCase();
  return prov.includes("palmas") || prov.includes("tenerife");
}

export function MunicipalitiesChoroplethMap({
  overlays,
  onlyWithProfessionals,
  onSelectMunicipality,
  height = "min(72vh, 640px)",
}: Props) {
  const mainContainerRef = useRef<HTMLDivElement | null>(null);
  const insetContainerRef = useRef<HTMLDivElement | null>(null);
  const mainMapRef = useRef<L.Map | null>(null);
  const insetMapRef = useRef<L.Map | null>(null);
  const mainLayerRef = useRef<L.GeoJSON | null>(null);
  const insetLayerRef = useRef<L.GeoJSON | null>(null);

  const overlayMap = useMemo(() => {
    const m = new Map<string, ChoroplethOverlay>();
    for (const o of overlays ?? []) m.set(o.code, o);
    return m;
  }, [overlays]);

  // init maps once
  useEffect(() => {
    if (!mainContainerRef.current || mainMapRef.current) return;

    const commonOpts: L.MapOptions = {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      worldCopyJump: false,
      scrollWheelZoom: false,
      dragging: true,
    };

    const main = L.map(mainContainerRef.current, {
      ...commonOpts,
      zoomControl: true,
      minZoom: 4,
    });
    main.fitBounds(PENINSULA_BOUNDS, { animate: false, padding: [8, 8] });
    mainMapRef.current = main;

    if (insetContainerRef.current) {
      const inset = L.map(insetContainerRef.current, {
        ...commonOpts,
        dragging: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
      });
      inset.fitBounds(CANARIAS_BOUNDS, { animate: false, padding: [4, 4] });
      insetMapRef.current = inset;
    }

    const ro = new ResizeObserver(() => {
      main.invalidateSize();
      insetMapRef.current?.invalidateSize();
    });
    ro.observe(mainContainerRef.current);

    return () => {
      ro.disconnect();
      main.remove();
      insetMapRef.current?.remove();
      mainMapRef.current = null;
      insetMapRef.current = null;
      mainLayerRef.current = null;
      insetLayerRef.current = null;
    };
  }, []);

  // render polygons
  useEffect(() => {
    const main = mainMapRef.current;
    if (!main) return;
    let cancelled = false;

    loadMunicipalities().then((geo) => {
      if (cancelled) return;

      const shouldInclude = (f: GeoJSON.Feature) => {
        if (!onlyWithProfessionals) return true;
        const code = (f.properties as any)?.codigo_ine as string | undefined;
        return code ? (overlayMap.get(code)?.professionals_count ?? 0) > 0 : false;
      };

      const peninsulaFeatures = geo.features.filter((f) => !isCanarias(f) && shouldInclude(f));
      const canariasFeatures = geo.features.filter((f) => isCanarias(f) && shouldInclude(f));

      const styleFn: L.StyleFunction = (feature) => {
        const props = feature?.properties as any;
        const pop = Number(props?.habitantes ?? 0);
        const code = props?.codigo_ine as string | undefined;
        const has = code ? (overlayMap.get(code)?.professionals_count ?? 0) > 0 : false;
        return {
          color: has ? "#0f172a" : "#94a3b8",
          weight: has ? 1.1 : 0.35,
          opacity: has ? 0.9 : 0.7,
          fillColor: colorForPopulation(pop),
          fillOpacity: has ? 0.9 : 0.7,
        };
      };

      const bindFeature = (feature: GeoJSON.Feature, lyr: L.Layer) => {
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
        (lyr as L.Path).bindTooltip(
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
          (e.target as L.Path).setStyle(styleFn(feature) as L.PathOptions);
        });
      };
...
      const mainLayer = L.geoJSON(
        { type: "FeatureCollection", features: peninsulaFeatures } as GeoJSON.FeatureCollection,
        {
          style: styleFn,
          onEachFeature: bindFeature,
        },
      );
      mainLayer.addTo(main);
      mainLayerRef.current = mainLayer;

      // Inset map: Canarias
      const inset = insetMapRef.current;
      if (inset) {
        if (insetLayerRef.current) {
          insetLayerRef.current.remove();
          insetLayerRef.current = null;
        }
        const insetLayer = L.geoJSON(
          { type: "FeatureCollection", features: canariasFeatures } as GeoJSON.FeatureCollection,
          {
            style: styleFn,
            onEachFeature: (feature, lyr) => bindFeature(insetLayer, feature, lyr),
          },
        );
        insetLayer.addTo(inset);
        insetLayerRef.current = insetLayer;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [overlayMap, onlyWithProfessionals, onSelectMunicipality]);

  return (
    <div className="w-full">
      <div
        className="relative w-full rounded-lg border overflow-hidden bg-slate-50"
        style={{ height, minHeight: 380 }}
        role="region"
        aria-label="Mapa coroplético de municipios de España menores de 20.000 habitantes"
      >
        <div ref={mainContainerRef} className="absolute inset-0" style={{ background: "#f8fafc" }} />
        <div
          className="absolute bottom-2 left-2 rounded-md border-2 border-slate-300 bg-white shadow-md overflow-hidden"
          style={{ width: 180, height: 110 }}
          aria-label="Islas Canarias"
        >
          <div ref={insetContainerRef} className="absolute inset-0" style={{ background: "#f8fafc" }} />
          <div className="pointer-events-none absolute top-1 left-1.5 text-[10px] font-semibold text-slate-600 bg-white/80 px-1 rounded">
            Canarias
          </div>
        </div>
      </div>
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
