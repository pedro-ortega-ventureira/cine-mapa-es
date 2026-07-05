import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";

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

// Icono por defecto de Leaflet: sus imágenes se cargan por URL relativa al CSS;
// como servimos el CSS desde un CDN, sobreescribimos las URLs explícitamente.
const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

const exactIcon = new L.Icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const approxIcon = L.divIcon({
  className: "leaflet-approx-marker",
  html: `<div style="width:22px;height:22px;border-radius:50%;background:rgba(120,120,120,0.55);border:2px dashed white;box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -12],
});

function popupHtml(p: MapProfessional) {
  const photo = p.photo_url
    ? `<img src="${p.photo_url}" alt="" style="width:56px;height:56px;border-radius:50%;object-fit:cover;float:left;margin-right:8px" />`
    : "";
  const verified = p.verified
    ? `<span style="display:inline-block;padding:1px 6px;border-radius:4px;background:#dcfce7;color:#166534;font-size:11px;margin-left:4px">verificado</span>`
    : "";
  const approx =
    p.geo_accuracy === "province"
      ? `<div style="color:#a16207;font-size:11px;margin-top:4px">📍 ubicación aproximada (provincia)</div>`
      : "";
  const loc =
    [p.geo_municipality_name, p.geo_province].filter(Boolean).join(", ") || "—";
  return `
    <div style="min-width:200px;font-family:system-ui,sans-serif;line-height:1.35">
      ${photo}
      <div style="overflow:hidden">
        <div style="font-weight:600;font-size:14px">${escapeHtml(p.full_name)}${verified}</div>
        ${p.alias ? `<div style="font-size:12px;color:#666">${escapeHtml(p.alias)}</div>` : ""}
        ${p.primary_role ? `<div style="font-size:12px;color:#4f46e5;margin-top:2px">${escapeHtml(p.primary_role)}</div>` : ""}
        <div style="font-size:12px;color:#666;margin-top:2px">${escapeHtml(loc)}</div>
      </div>
      <div style="clear:both;margin-top:8px">
        <a href="/profesionales/${encodeURIComponent(p.slug)}" style="color:#2563eb;font-size:12px;text-decoration:underline">Ver ficha →</a>
      </div>
      ${approx}
    </div>
  `;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

type Props = {
  professionals: MapProfessional[];
};

export function ProfessionalsLeafletMap({ professionals }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  // init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [40.0, -3.7], // centro peninsular
      zoom: 6,
      minZoom: 4,
      worldCopyJump: false,
      preferCanvas: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const cluster = (L as unknown as { markerClusterGroup: (o?: unknown) => L.MarkerClusterGroup })
      .markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        maxClusterRadius: 50,
      });
    map.addLayer(cluster);

    mapRef.current = map;
    clusterRef.current = cluster;

    // ajusta al contenedor si cambia
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
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
        icon: p.geo_accuracy === "exact" ? exactIcon : approxIcon,
      });
      m.bindPopup(popupHtml(p));
      markers.push(m);
    }
    cluster.addLayers(markers);

    if (markers.length && mapRef.current) {
      const bounds = L.latLngBounds(professionals.map((p) => [p.geo_lat, p.geo_lng]));
      mapRef.current.fitBounds(bounds.pad(0.15), { maxZoom: 9, animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg border overflow-hidden"
      style={{ height: "min(70vh, 640px)", minHeight: 380 }}
      role="region"
      aria-label="Mapa de profesionales geolocalizados"
    />
  );
}
