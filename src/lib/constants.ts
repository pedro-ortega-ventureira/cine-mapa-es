export const PRIMARY_ROLES = [
  "Dirección / Realización",
  "Dirección de fotografía / Cámara",
  "Guion",
  "Producción",
  "Montaje / Edición",
  "Sonido",
  "Música / Composición",
  "Arte / Decorados / Vestuario",
  "Efectos visuales / Animación",
  "Distribución / Gestión cultural / Marketing",
  "Docencia / Investigación",
  "Finanzas / Administración",
  "Otros / Multidisciplinar",
] as const;

export const PRODUCTION_TYPES = [
  "Largometraje de ficción",
  "Largometraje documental",
  "Cortometraje de ficción",
  "Cortometraje documental",
  "Publicidad / Spot",
  "Videoclip musical",
  "Contenido institucional / corporativo",
  "Serie de televisión",
  "Miniserie / TV Movie",
  "Animación",
  "Realidad Virtual / 360º",
  "Contenido para plataformas digitales",
  "Periodismo audiovisual / Reportaje",
  "Eventos en directo / Livestream",
  "Videojuegos / Motion Capture",
  "Fotografía de producción",
] as const;

export const AUTONOMOUS_COMMUNITIES = [
  "Andalucía",
  "Aragón",
  "Asturias",
  "Baleares",
  "Canarias",
  "Cantabria",
  "Castilla-La Mancha",
  "Castilla y León",
  "Cataluña",
  "Extremadura",
  "Galicia",
  "La Rioja",
  "Madrid",
  "Murcia",
  "Navarra",
  "País Vasco",
  "Valencia",
  "Ceuta",
  "Melilla",
] as const;

// Escala secuencial: menos habitantes = color más intenso
export const POPULATION_BUCKETS = [
  { max: 500, label: "< 500", color: "#0c1e6b" },
  { max: 2000, label: "500 – 2.000", color: "#1d4ed8" },
  { max: 5000, label: "2.000 – 5.000", color: "#3b82f6" },
  { max: 10000, label: "5.000 – 10.000", color: "#93c5fd" },
  { max: 20000, label: "10.000 – 20.000", color: "#dbeafe" },
] as const;

export function bucketFor(pop: number) {
  for (const b of POPULATION_BUCKETS) if (pop < b.max) return b;
  return POPULATION_BUCKETS[POPULATION_BUCKETS.length - 1];
}

export function colorForPopulation(pop: number | null | undefined): string {
  if (pop == null) return "#e5e7eb";
  return bucketFor(pop).color;
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

// Spain bounding box for SVG projection (mainland + Baleares)
export const SPAIN_BBOX = {
  minLng: -9.5,
  maxLng: 4.5,
  minLat: 35.9,
  maxLat: 43.9,
};

// Canary Islands separate bbox (will render as inset)
export const CANARIAS_BBOX = {
  minLng: -18.3,
  maxLng: -13.3,
  minLat: 27.5,
  maxLat: 29.5,
};

export function isCanarias(lat: number, lng: number) {
  return lat < 30 && lng < -12;
}
