// Centroides aproximados de las provincias españolas.
// Indexado por los 2 primeros dígitos del código postal (código ISO provincia).
// Fuente: valores medios geográficos de cada provincia (uso: fallback cuando el CP
// exacto no se puede resolver).

export type ProvinceCentroid = { name: string; lat: number; lng: number };

export const PROVINCE_BY_CP2: Record<string, ProvinceCentroid> = {
  "01": { name: "Álava", lat: 42.85, lng: -2.67 },
  "02": { name: "Albacete", lat: 38.83, lng: -1.86 },
  "03": { name: "Alicante", lat: 38.5, lng: -0.5 },
  "04": { name: "Almería", lat: 37.19, lng: -2.35 },
  "05": { name: "Ávila", lat: 40.45, lng: -5.0 },
  "06": { name: "Badajoz", lat: 38.88, lng: -6.37 },
  "07": { name: "Illes Balears", lat: 39.57, lng: 2.9 },
  "08": { name: "Barcelona", lat: 41.72, lng: 2.0 },
  "09": { name: "Burgos", lat: 42.35, lng: -3.7 },
  "10": { name: "Cáceres", lat: 39.75, lng: -6.2 },
  "11": { name: "Cádiz", lat: 36.55, lng: -5.9 },
  "12": { name: "Castellón", lat: 40.15, lng: -0.15 },
  "13": { name: "Ciudad Real", lat: 38.98, lng: -3.93 },
  "14": { name: "Córdoba", lat: 37.87, lng: -4.78 },
  "15": { name: "A Coruña", lat: 43.15, lng: -8.4 },
  "16": { name: "Cuenca", lat: 40.07, lng: -2.14 },
  "17": { name: "Girona", lat: 42.15, lng: 2.65 },
  "18": { name: "Granada", lat: 37.35, lng: -3.15 },
  "19": { name: "Guadalajara", lat: 40.85, lng: -2.65 },
  "20": { name: "Gipuzkoa", lat: 43.15, lng: -2.15 },
  "21": { name: "Huelva", lat: 37.65, lng: -6.85 },
  "22": { name: "Huesca", lat: 42.35, lng: -0.15 },
  "23": { name: "Jaén", lat: 38.0, lng: -3.5 },
  "24": { name: "León", lat: 42.7, lng: -5.85 },
  "25": { name: "Lleida", lat: 42.05, lng: 1.15 },
  "26": { name: "La Rioja", lat: 42.3, lng: -2.5 },
  "27": { name: "Lugo", lat: 43.0, lng: -7.5 },
  "28": { name: "Madrid", lat: 40.45, lng: -3.7 },
  "29": { name: "Málaga", lat: 36.75, lng: -4.65 },
  "30": { name: "Murcia", lat: 38.0, lng: -1.5 },
  "31": { name: "Navarra", lat: 42.7, lng: -1.65 },
  "32": { name: "Ourense", lat: 42.25, lng: -7.7 },
  "33": { name: "Asturias", lat: 43.35, lng: -6.05 },
  "34": { name: "Palencia", lat: 42.35, lng: -4.5 },
  "35": { name: "Las Palmas", lat: 28.15, lng: -15.5 },
  "36": { name: "Pontevedra", lat: 42.4, lng: -8.55 },
  "37": { name: "Salamanca", lat: 40.85, lng: -6.1 },
  "38": { name: "Santa Cruz de Tenerife", lat: 28.4, lng: -16.55 },
  "39": { name: "Cantabria", lat: 43.2, lng: -4.05 },
  "40": { name: "Segovia", lat: 41.15, lng: -4.05 },
  "41": { name: "Sevilla", lat: 37.5, lng: -5.65 },
  "42": { name: "Soria", lat: 41.75, lng: -2.55 },
  "43": { name: "Tarragona", lat: 41.15, lng: 0.8 },
  "44": { name: "Teruel", lat: 40.65, lng: -0.9 },
  "45": { name: "Toledo", lat: 39.85, lng: -3.85 },
  "46": { name: "Valencia", lat: 39.4, lng: -0.75 },
  "47": { name: "Valladolid", lat: 41.6, lng: -4.75 },
  "48": { name: "Bizkaia", lat: 43.25, lng: -2.8 },
  "49": { name: "Zamora", lat: 41.7, lng: -6.05 },
  "50": { name: "Zaragoza", lat: 41.65, lng: -1.15 },
  "51": { name: "Ceuta", lat: 35.89, lng: -5.32 },
  "52": { name: "Melilla", lat: 35.29, lng: -2.94 },
};

export function normalizePostalCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  const padded = digits.padStart(5, "0").slice(-5);
  if (padded.length !== 5) return null;
  const prefix = padded.slice(0, 2);
  if (!PROVINCE_BY_CP2[prefix]) return null; // fuera de rango España
  return padded;
}
