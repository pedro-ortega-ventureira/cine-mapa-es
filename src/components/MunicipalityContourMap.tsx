import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  municipalityCode?: string | null;
  municipalityName?: string | null;
  lat?: number | null;
  lng?: number | null;
  color?: string;
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

export function MunicipalityContourMap({
  municipalityCode,
  municipalityName,
  lat,
  lng,
  color = "#2563eb",
  height = 260,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // clean any previous instance
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    const el = containerRef.current;
    (el as any)._leaflet_id = null;

    const map = L.map(el, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
      maxZoom: 18,
    });
    mapRef.current = map;
    map.setView([40.4, -3.7], 5);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    let cancelled = false;

    (async () => {
      const fc = await loadMunicipalities();
      if (cancelled) return;

      const codeStr = municipalityCode ? String(municipalityCode).padStart(5, "0") : null;
      const nameNorm = (municipalityName ?? "").trim().toLowerCase();

      const feature = fc.features.find((f) => {
        const props: any = f.properties ?? {};
        const ine = String(props.codigo_ine ?? "").padStart(5, "0");
        if (codeStr && ine === codeStr) return true;
        if (!codeStr && nameNorm && String(props.municipio ?? "").toLowerCase() === nameNorm) return true;
        return false;
      });

      if (feature) {
        const layer = L.geoJSON(feature as any, {
          style: {
            color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.15,
          },
        }).addTo(map);

        const props = feature.properties as any;
        const labelName = municipalityName || props?.municipio || "Municipio";
        try {
          const center = layer.getBounds().getCenter();
          const labelIcon = L.divIcon({
            className: "municipality-label",
            html: `<div class="municipality-label-inner" style="
              font-family:system-ui,sans-serif;
              font-size:13px;
              font-weight:700;
              color:#0f172a;
              text-align:center;
              line-height:1.2;
              padding:4px 8px;
              border-radius:999px;
              background:rgba(255,255,255,0.85);
              box-shadow:0 1px 3px rgba(15,23,42,0.18);
              white-space:nowrap;
              pointer-events:none;
            ">${escapeHtml(labelName)}</div>`,
            iconSize: [120, 28],
            iconAnchor: [60, 14],
          });
          L.marker(center, { icon: labelIcon, zIndexOffset: 1000, interactive: false }).addTo(map);
          map.fitBounds(layer.getBounds(), { padding: [28, 28], maxZoom: 13 });
        } catch {}
      } else if (lat != null && lng != null) {
        map.setView([lat, lng], 11);
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [municipalityCode, municipalityName, lat, lng, color]);

  return (
    <div
      ref={containerRef}
      style={{ height, background: "#f8fafc" }}
      className="w-full rounded-md border overflow-hidden"
    />
  );
}

function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

export default MunicipalityContourMap;
