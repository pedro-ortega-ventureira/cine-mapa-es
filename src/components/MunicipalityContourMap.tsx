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
      attributionControl: false,
      scrollWheelZoom: false,
      maxZoom: 18,
    });
    mapRef.current = map;
    map.setView([40.4, -3.7], 5);

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
        try {
          map.fitBounds(layer.getBounds(), { padding: [16, 16] });
        } catch {}
      } else if (lat != null && lng != null) {
        map.setView([lat, lng], 11);
      }

      if (lat != null && lng != null) {
        L.circleMarker([lat, lng], {
          radius: 7,
          color: "#fff",
          weight: 2,
          fillColor: color,
          fillOpacity: 1,
        }).addTo(map);
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

export default MunicipalityContourMap;
