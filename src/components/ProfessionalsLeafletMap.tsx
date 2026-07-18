import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { colorForPopulation } from "@/lib/constants";

export type MapProfessional = {
  id: string;
  slug: string;
  full_name: string;
  alias: string | null;
  photo_url: string | null;
  primary_role: string | null;
  verified: boolean;
  geo_lat: number;
  geo_lng: number;
  geo_accuracy: "exact" | "province";
  geo_municipality_name: string | null;
  geo_province: string | null;
};

// -------- Icon cache --------
const iconCache = new Map<string, L.DivIcon>();

export const ROLE_COLORS: Record<string, string> = {
  "Dirección": "#ef4444",
  "Guion": "#f97316",
  "Producción": "#eab308",
  "Dirección de fotografía": "#84cc16",
  "Cámara": "#22c55e",
  "Sonido": "#06b6d4",
  "Montaje": "#3b82f6",
  "Arte": "#8b5cf6",
  "Vestuario": "#ec4899",
  "Maquillaje": "#f43f5e",
  "Interpretación": "#14b8a6",
  "VFX": "#a855f7",
  "Postproducción": "#6366f1",
};
const ROLE_DEFAULT = "#64748b";

function colorForRole(role: string | null): string {
  if (!role) return ROLE_DEFAULT;
  if (ROLE_COLORS[role]) return ROLE_COLORS[role];
  let h = 0;
  for (let i = 0; i < role.length; i++) h = (h * 31 + role.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360} 65% 50%)`;
}

function exactIconFor(p: MapProfessional): L.DivIcon {
  const key = p.photo_url ? `p:${p.photo_url}` : `d:${p.primary_role ?? "_"}:${p.verified ? 1 : 0}`;
  const hit = iconCache.get(key);
  if (hit) return hit;

  let html: string;
  let size: number;
  if (p.photo_url) {
    size = 44;
    const badge = p.verified
      ? `<span style="position:absolute;right:-2px;bottom:-2px;width:16px;height:16px;border-radius:50%;background:#10b981;border:2px solid white;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;line-height:1;font-weight:700">✓</span>`
      : "";
    html = `
      <div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);overflow:visible;background:white">
        <div style="position:absolute;inset:0;border-radius:50%;overflow:hidden;background-image:url('${escapeAttr(p.photo_url)}');background-size:cover;background-position:center"></div>
        ${badge}
      </div>
    `;
  } else {
    size = 20;
    const color = colorForRole(p.primary_role);
    html = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`;
  }

  const icon = L.divIcon({
    className: "leaflet-photo-marker",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
  iconCache.set(key, icon);
  return icon;
}

const approxIcon = L.divIcon({
  className: "leaflet-approx-marker",
  html: `<div style="width:28px;height:28px;border-radius:50%;background:rgba(120,120,120,0.55);border:2px dashed white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

function popupHtml(p: MapProfessional) {
  const photo = p.photo_url
    ? `<img src="${escapeAttr(p.photo_url)}" alt="" style="width:56px;height:56px;border-radius:50%;object-fit:cover;float:left;margin-right:8px" />`
    : `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${colorForRole(p.primary_role)};border:2px solid white;box-shadow:0 1px 2px rgba(0,0,0,.3);float:left;margin:4px 8px 0 0"></span>`;
  const verified = p.verified
    ? `<span style="display:inline-block;padding:1px 6px;border-radius:4px;background:#dcfce7;color:#166534;font-size:11px;margin-left:4px">verificado</span>`
    : "";
  const approx = p.geo_accuracy === "province" ? ` <span style="color:#a16207">(aprox.)</span>` : "";
  const loc = [p.geo_municipality_name, p.geo_province].filter(Boolean).join(" / ") || "—";
  return `
    <div style="min-width:220px;font-family:system-ui,sans-serif;line-height:1.35">
      ${photo}
      <div style="overflow:hidden">
        <div style="font-weight:600;font-size:14px">${escapeHtml(p.full_name)}${verified}</div>
        ${p.alias ? `<div style="font-size:12px;color:#666">${escapeHtml(p.alias)}</div>` : ""}
        ${p.primary_role ? `<div style="font-size:12px;color:#4f46e5;margin-top:2px">${escapeHtml(p.primary_role)}</div>` : ""}
      </div>
      <div style="clear:both;margin-top:8px">
        <a href="/profesionales/${encodeURIComponent(p.slug)}" style="color:#2563eb;font-size:12px;text-decoration:underline">Ver ficha →</a>
      </div>
      <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e5e7eb;font-size:11px;color:#475569">
        📍 ${escapeHtml(loc)}${approx}
      </div>
    </div>
  `;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function escapeAttr(s: string) {
  return s.replace(/["'<>&]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// -------- Municipios GeoJSON --------
const MUNI_GEOJSON_URL = "/geo/municipios-lt20k.geojson";
let muniGeoPromise: Promise<GeoJSON.FeatureCollection | null> | null = null;
function loadMuniGeo(): Promise<GeoJSON.FeatureCollection | null> {
  if (muniGeoPromise) return muniGeoPromise;
  muniGeoPromise = fetch(MUNI_GEOJSON_URL)
    .then((r) => (r.ok ? (r.json() as Promise<GeoJSON.FeatureCollection>) : null))
    .catch(() => null);
  return muniGeoPromise;
}

function isCanariasFeature(feature: GeoJSON.Feature): boolean {
  const prov = String((feature.properties as any)?.provincia ?? "").toLowerCase();
  return prov.includes("palmas") || prov.includes("tenerife");
}

const PENINSULA_BOUNDS = L.latLngBounds(L.latLng(35.8, -9.8), L.latLng(44.0, 4.6));
const CANARIAS_BOUNDS = L.latLngBounds(L.latLng(27.4, -18.4), L.latLng(29.5, -13.3));

function isInCanarias(lat: number, lng: number) {
  return lat >= 27.4 && lat <= 29.5 && lng >= -18.5 && lng <= -13.3;
}

type Props = { professionals: MapProfessional[] };

export function ProfessionalsLeafletMap({ professionals }: Props) {
  const mainContainerRef = useRef<HTMLDivElement | null>(null);
  const insetContainerRef = useRef<HTMLDivElement | null>(null);
  const mainMapRef = useRef<L.Map | null>(null);
  const insetMapRef = useRef<L.Map | null>(null);
  const mainClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const insetClusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (!mainContainerRef.current || mainMapRef.current) return;

    const main = L.map(mainContainerRef.current, {
      minZoom: 4,
      worldCopyJump: false,
      preferCanvas: true,
      attributionControl: false,
      scrollWheelZoom: false,
    });
    main.fitBounds(PENINSULA_BOUNDS, { animate: false, padding: [10, 10] });

    const mainCluster = (L as unknown as { markerClusterGroup: (o?: unknown) => L.MarkerClusterGroup })
      .markerClusterGroup({ showCoverageOnHover: false, spiderfyOnMaxZoom: true, maxClusterRadius: 45 });
    main.addLayer(mainCluster);
    mainMapRef.current = main;
    mainClusterRef.current = mainCluster;

    let inset: L.Map | null = null;
    if (insetContainerRef.current) {
      inset = L.map(insetContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
      });
      inset.fitBounds(CANARIAS_BOUNDS, { animate: false, padding: [4, 4] });
      const insetCluster = (L as unknown as { markerClusterGroup: (o?: unknown) => L.MarkerClusterGroup })
        .markerClusterGroup({ showCoverageOnHover: false, spiderfyOnMaxZoom: true, maxClusterRadius: 30 });
      inset.addLayer(insetCluster);
      insetMapRef.current = inset;
      insetClusterRef.current = insetCluster;
    }

    loadMuniGeo().then((geo) => {
      if (!geo) return;
      const peninsula: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: geo.features.filter((f) => !isCanariasFeature(f)),
      };
      const canarias: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: geo.features.filter((f) => isCanariasFeature(f)),
      };
      const styleFn: L.StyleFunction = (feature) => {
        const pop = Number((feature?.properties as any)?.habitantes ?? 0);
        return {
          color: "#475569",
          weight: 0.3,
          opacity: 0.7,
          fillColor: colorForPopulation(pop),
          fillOpacity: 0.7,
        };
      };
      if (mainMapRef.current) {
        L.geoJSON(peninsula, { interactive: false, style: styleFn }).addTo(mainMapRef.current).bringToBack();
      }
      if (insetMapRef.current) {
        L.geoJSON(canarias, { interactive: false, style: styleFn }).addTo(insetMapRef.current).bringToBack();
      }
    });

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
      mainClusterRef.current = null;
      insetClusterRef.current = null;
    };
  }, []);

  const key = useMemo(() => professionals.map((p) => p.id).join("|"), [professionals]);
  useEffect(() => {
    const mainCluster = mainClusterRef.current;
    const insetCluster = insetClusterRef.current;
    if (!mainCluster) return;
    mainCluster.clearLayers();
    insetCluster?.clearLayers();
    const mainMarkers: L.Marker[] = [];
    const insetMarkers: L.Marker[] = [];
    for (const p of professionals) {
      const m = L.marker([p.geo_lat, p.geo_lng], {
        icon: p.geo_accuracy === "exact" ? exactIconFor(p) : approxIcon,
        title: p.full_name,
      });
      m.bindPopup(popupHtml(p));
      if (isInCanarias(p.geo_lat, p.geo_lng)) insetMarkers.push(m);
      else mainMarkers.push(m);
    }
    mainCluster.addLayers(mainMarkers);
    insetCluster?.addLayers(insetMarkers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div
      className="relative w-full rounded-lg border overflow-hidden bg-slate-50"
      style={{ height: "min(72vh, 680px)", minHeight: 420 }}
      role="region"
      aria-label="Mapa de profesionales verificados en España"
    >
      <div ref={mainContainerRef} className="absolute inset-0" style={{ background: "#f8fafc" }} />
      <div
        className="absolute bottom-2 left-2 rounded-md border-2 border-slate-300 bg-white shadow-md overflow-hidden"
        style={{ width: 200, height: 120 }}
        aria-label="Islas Canarias"
      >
        <div ref={insetContainerRef} className="absolute inset-0" style={{ background: "#f8fafc" }} />
        <div className="pointer-events-none absolute top-1 left-1.5 text-[10px] font-semibold text-slate-600 bg-white/80 px-1 rounded z-[500]">
          Canarias
        </div>
      </div>
    </div>
  );
}
