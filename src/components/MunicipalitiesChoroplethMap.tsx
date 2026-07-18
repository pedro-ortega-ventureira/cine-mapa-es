import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { POPULATION_BUCKETS, colorForPopulation } from "@/lib/constants";
import { colorForRole } from "@/lib/roles";

export type ChoroplethOverlay = {
  code: string; // codigo_ine
  professionals_count: number;
  verified_count?: number;
};

export type MapProfessional = {
  id: string;
  slug: string;
  full_name: string;
  primary_role: string | null;
  postal_code: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_municipality_name: string | null;
  geo_province: string | null;
};

type Props = {
  overlays?: ChoroplethOverlay[];
  professionals?: MapProfessional[];
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

function isCanariasFeature(feature: GeoJSON.Feature): boolean {
  const prov = String((feature.properties as any)?.provincia ?? "").toLowerCase();
  return prov.includes("palmas") || prov.includes("tenerife");
}

function isCanariasPoint(p: MapProfessional): boolean {
  const prov = (p.geo_province ?? "").toLowerCase();
  if (prov.includes("palmas") || prov.includes("tenerife")) return true;
  // fallback by longitude
  return typeof p.geo_lng === "number" && p.geo_lng < -12;
}

export function MunicipalitiesChoroplethMap({
  overlays,
  professionals,
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
  const mainProsRef = useRef<L.LayerGroup | null>(null);
  const insetProsRef = useRef<L.LayerGroup | null>(null);

  const overlayMap = useMemo(() => {
    const m = new Map<string, ChoroplethOverlay>();
    for (const o of overlays ?? []) m.set(o.code, o);
    return m;
  }, [overlays]);

  // init maps once
  useEffect(() => {
    if (!mainContainerRef.current || mainMapRef.current) return;

    const mainContainer = mainContainerRef.current;
    mainContainer.innerHTML = "";
    (mainContainer as any)._leaflet_id = null;

    const commonOpts: L.MapOptions = {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      worldCopyJump: false,
      scrollWheelZoom: false,
      dragging: true,
    };

    const main = L.map(mainContainer, {
      ...commonOpts,
      zoomControl: true,
      minZoom: 4,
      maxZoom: 18,
    });
    main.fitBounds(PENINSULA_BOUNDS, { animate: false, padding: [8, 8] });
    main.createPane("pros");
    const proPane = main.getPane("pros");
    if (proPane) proPane.style.zIndex = "650";
    mainMapRef.current = main;

    if (insetContainerRef.current) {
      const insetContainer = insetContainerRef.current;
      insetContainer.innerHTML = "";
      (insetContainer as any)._leaflet_id = null;
      const inset = L.map(insetContainer, {
        ...commonOpts,
        dragging: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
        maxZoom: 12,
      });
      inset.fitBounds(CANARIAS_BOUNDS, { animate: false, padding: [4, 4] });
      inset.createPane("pros");
      const insetProPane = inset.getPane("pros");
      if (insetProPane) insetProPane.style.zIndex = "650";
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
      mainProsRef.current = null;
      insetProsRef.current = null;
      if (mainContainerRef.current) {
        mainContainerRef.current.innerHTML = "";
        (mainContainerRef.current as any)._leaflet_id = null;
      }
      if (insetContainerRef.current) {
        insetContainerRef.current.innerHTML = "";
        (insetContainerRef.current as any)._leaflet_id = null;
      }
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

      const peninsulaFeatures = geo.features.filter((f) => !isCanariasFeature(f) && shouldInclude(f));
      const canariasFeatures = geo.features.filter((f) => isCanariasFeature(f) && shouldInclude(f));

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

      if (mainLayerRef.current) {
        mainLayerRef.current.remove();
        mainLayerRef.current = null;
      }
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
            onEachFeature: bindFeature,
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

  // render professional points
  useEffect(() => {
    const main = mainMapRef.current;
    if (!main) return;

    // clear
    if (mainProsRef.current) {
      mainProsRef.current.remove();
      mainProsRef.current = null;
    }
    if (insetProsRef.current) {
      insetProsRef.current.remove();
      insetProsRef.current = null;
    }

    if (!professionals || professionals.length === 0) return;

    const valid = professionals.filter(
      (p) => typeof p.geo_lat === "number" && typeof p.geo_lng === "number",
    );

    // Group by postal_code (fallback: rounded lat/lng)
    const groups = new Map<string, MapProfessional[]>();
    for (const p of valid) {
      const key = p.postal_code && p.postal_code.trim()
        ? `cp:${p.postal_code.trim()}`
        : `xy:${p.geo_lat!.toFixed(4)}|${p.geo_lng!.toFixed(4)}`;
      const arr = groups.get(key) ?? [];
      arr.push(p);
      groups.set(key, arr);
    }

    const mainGroup = L.layerGroup().addTo(main);
    mainProsRef.current = mainGroup;
    const inset = insetMapRef.current;
    const insetGroup = inset ? L.layerGroup().addTo(inset) : null;
    if (insetGroup) insetProsRef.current = insetGroup;

    for (const [key, list] of groups) {
      const first = list[0];
      const lat = first.geo_lat!;
      const lng = first.geo_lng!;
      const target = isCanariasPoint(first) ? insetGroup : mainGroup;
      if (!target) continue;

      if (list.length === 1) {
        const p = first;
        const isInset = target === insetGroup;
        const color = colorForRole(p.primary_role);
        const marker = L.circleMarker([lat, lng], {
          pane: "pros",
          radius: isInset ? 8 : 10,
          color: "#ffffff",
          weight: 3,
          fillColor: color,
          fillOpacity: 0.95,
          opacity: 1,
        });
        const loc = [p.geo_municipality_name, p.geo_province].filter(Boolean).join(" / ");
        marker.bindPopup(
          `<div style="font-family:system-ui;line-height:1.35;min-width:180px">
            <div style="font-weight:600">
              <a href="/profesionales/${encodeURIComponent(p.slug)}" style="color:#0f172a;text-decoration:none">${escapeHtml(p.full_name)}</a>
            </div>
            ${p.primary_role ? `<div style="font-size:12px;color:${color};font-weight:600">${escapeHtml(p.primary_role)}</div>` : ""}
            ${loc ? `<div style="margin-top:4px;padding-top:4px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b">${escapeHtml(loc)}</div>` : ""}
          </div>`,
        );
        marker.addTo(target);
      } else {
        const isInset = target === insetGroup;
        const count = list.length;
        const size = isInset
          ? Math.min(36, 26 + Math.round(Math.log2(count) * 4))
          : Math.min(48, 34 + Math.round(Math.log2(count) * 5));
        const cp = key.startsWith("cp:") ? key.slice(3) : "";
        const municipality = first.geo_municipality_name ?? "";
        const province = first.geo_province ?? "";
        const header = `${count} profesionales${cp ? ` en CP ${escapeHtml(cp)}` : ""}${municipality ? ` — ${escapeHtml(municipality)}` : ""}${province ? ` (${escapeHtml(province)})` : ""}`;
        const items = list
          .map((p) => {
            const c = colorForRole(p.primary_role);
            return `<li style="display:flex;align-items:center;gap:6px;padding:3px 0">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};flex:none"></span>
              <a href="/profesionales/${encodeURIComponent(p.slug)}" style="color:#0f172a;text-decoration:none;font-size:12px;flex:1">${escapeHtml(p.full_name)}</a>
              ${p.primary_role ? `<span style="font-size:10px;color:${c}">${escapeHtml(p.primary_role)}</span>` : ""}
            </li>`;
          })
          .join("");
        const html = `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:#0f172a;color:#fff;
            display:flex;align-items:center;justify-content:center;
            font:600 12px/1 system-ui;
            box-shadow:0 0 0 4px rgba(255,255,255,0.9), 0 0 0 7px rgba(15,23,42,0.12);
          ">${count}</div>`;
        const icon = L.divIcon({
          html,
          className: "pro-cluster",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        const marker = L.marker([lat, lng], { icon, pane: "pros" });
        marker.bindPopup(
          `<div style="font-family:system-ui;line-height:1.35;min-width:220px;max-width:280px">
            <div style="font-weight:600;font-size:12px">${header}</div>
            <ul style="list-style:none;margin:6px 0 0;padding:0;max-height:200px;overflow:auto">${items}</ul>
          </div>`,
        );
        marker.addTo(target);
      }
    }
  }, [professionals]);

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
