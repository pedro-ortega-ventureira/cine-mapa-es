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

// -------- Icon cache: one divIcon per (photo|initials+hue) --------
const iconCache = new Map<string, L.DivIcon>();


// Paleta por profesión. Mismos colores que se muestran en la leyenda.
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
  // fallback: hash → hue estable
  let h = 0;
  for (let i = 0; i < role.length; i++) h = (h * 31 + role.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360} 65% 50%)`;
}

function exactIconFor(p: MapProfessional): L.DivIcon {
  const key = p.photo_url
    ? `p:${p.photo_url}`
    : `d:${p.primary_role ?? "_"}:${p.verified ? 1 : 0}`;
  const hit = iconCache.get(key);
  if (hit) return hit;

  let html: string;
  let size: number;
  if (p.photo_url) {
    size = 40;
    const badge = p.verified
      ? `<span style="position:absolute;right:-2px;bottom:-2px;width:14px;height:14px;border-radius:50%;background:#10b981;border:2px solid white;display:flex;align-items:center;justify-content:center;color:white;font-size:9px;line-height:1;font-weight:700">✓</span>`
      : "";
    html = `
      <div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);overflow:visible;background:white">
        <div style="position:absolute;inset:0;border-radius:50%;overflow:hidden;background-image:url('${escapeAttr(p.photo_url)}');background-size:cover;background-position:center"></div>
        ${badge}
      </div>
    `;
  } else {
    // Sin foto → punto pequeño coloreado por profesión
    size = 16;
    const color = colorForRole(p.primary_role);
    html = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`;
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
  html: `<div style="width:22px;height:22px;border-radius:50%;background:rgba(120,120,120,0.55);border:2px dashed white;box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -12],
});

function popupHtml(p: MapProfessional) {
  const photo = p.photo_url
    ? `<img src="${escapeAttr(p.photo_url)}" alt="" style="width:56px;height:56px;border-radius:50%;object-fit:cover;float:left;margin-right:8px" />`
    : `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${colorForRole(p.primary_role)};border:2px solid white;box-shadow:0 1px 2px rgba(0,0,0,.3);float:left;margin:4px 8px 0 0"></span>`;
  const verified = p.verified
    ? `<span style="display:inline-block;padding:1px 6px;border-radius:4px;background:#dcfce7;color:#166534;font-size:11px;margin-left:4px">verificado</span>`
    : "";
  const approx =
    p.geo_accuracy === "province"
      ? ` <span style="color:#a16207">(aprox.)</span>`
      : "";
  const loc =
    [p.geo_municipality_name, p.geo_province].filter(Boolean).join(" / ") || "—";
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
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}
function escapeAttr(s: string) {
  return s.replace(/["'<>&]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

// -------- Spain outline GeoJSON (cached at module + sessionStorage) --------
const SPAIN_GEOJSON_URL =
  "https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/spain-communities.geojson";
const SPAIN_CACHE_KEY = "spain-communities-geojson-v1";

let spainGeoPromise: Promise<GeoJSON.GeoJsonObject | null> | null = null;
function loadSpainGeo(): Promise<GeoJSON.GeoJsonObject | null> {
  if (spainGeoPromise) return spainGeoPromise;
  spainGeoPromise = (async () => {
    try {
      if (typeof sessionStorage !== "undefined") {
        const cached = sessionStorage.getItem(SPAIN_CACHE_KEY);
        if (cached) return JSON.parse(cached) as GeoJSON.GeoJsonObject;
      }
      const res = await fetch(SPAIN_GEOJSON_URL);
      if (!res.ok) return null;
      const json = (await res.json()) as GeoJSON.GeoJsonObject;
      try {
        sessionStorage?.setItem(SPAIN_CACHE_KEY, JSON.stringify(json));
      } catch {
        /* quota, ignore */
      }
      return json;
    } catch {
      return null;
    }
  })();
  return spainGeoPromise;
}

type Props = {
  professionals: MapProfessional[];
};

export function ProfessionalsLeafletMap({ professionals }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const spainLayerRef = useRef<L.GeoJSON | null>(null);

  // init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [39.5, -3.7], // ligeramente al sur para encuadrar Canarias
      zoom: 5,
      minZoom: 4,
      worldCopyJump: false,
      preferCanvas: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Encuadre inicial para ver Península + Baleares + Canarias
    map.fitBounds(
      L.latLngBounds(L.latLng(27.5, -18.5), L.latLng(44.0, 4.5)),
      { animate: false, padding: [10, 10] },
    );

    const cluster = (L as unknown as { markerClusterGroup: (o?: unknown) => L.MarkerClusterGroup })
      .markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        maxClusterRadius: 45,
      });
    map.addLayer(cluster);

    mapRef.current = map;
    clusterRef.current = cluster;

    // Perfil de España (comunidades autónomas) como capa de referencia
    loadSpainGeo().then((geo) => {
      if (!geo || !mapRef.current) return;
      const layer = L.geoJSON(geo, {
        interactive: false,
        style: {
          color: "#334155",
          weight: 1,
          opacity: 0.55,
          fillColor: "#64748b",
          fillOpacity: 0.08,
        },
      });
      layer.addTo(mapRef.current);
      // Colócala por debajo de los pines
      layer.bringToBack();
      spainLayerRef.current = layer;
    });

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      spainLayerRef.current = null;
    };
  }, []);

  // update markers when data changes
  const key = useMemo(
    () => professionals.map((p) => p.id).join("|"),
    [professionals],
  );
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();
    const markers: L.Marker[] = [];
    for (const p of professionals) {
      const m = L.marker([p.geo_lat, p.geo_lng], {
        icon: p.geo_accuracy === "exact" ? exactIconFor(p) : approxIcon,
        title: p.full_name,
      });
      m.bindPopup(popupHtml(p));
      markers.push(m);
    }
    cluster.addLayers(markers);
    // No re-encuadramos al cambiar el filtro para no desorientar al usuario;
    // mantenemos la vista nacional inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg border overflow-hidden"
      style={{ height: "min(72vh, 680px)", minHeight: 420 }}
      role="region"
      aria-label="Mapa de profesionales verificados en España"
    />
  );
}
