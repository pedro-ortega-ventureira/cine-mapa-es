// Cruce seguro entre el GeoJSON de municipios (<20.000 hab.) y la tabla
// `municipalities`. La tabla usa un `code` propio en forma de slug
// (`provincia-municipio`), NO el código INE, así que cualquier siembra basada
// en el INE no actualizaba ni una fila: `postal_codes` estaba vacío y el
// registro nunca podía resolver un código postal.
//
// Aquí se relaciona cada municipio por NOMBRE NORMALIZADO + PROVINCIA
// (tolerando acentos, nombres bilingües con barra y artículos antepuestos o
// pospuestos) y, solo cuando el nombre normalizado es único en toda España, se
// acepta como coincidencia sin provincia. Nunca se asigna un código postal a
// un municipio ambiguo.

export type GeoMunicipality = {
  codigo_ine?: string | number | null;
  municipio?: string | null;
  provincia?: string | null;
  codigo_postal?: string | number | null;
};

export type DbMunicipality = {
  code: string;
  name: string;
  province: string;
};

export type PostalAssignment = { code: string; postal_codes: string[] };

export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Artículos que aparecen antepuestos en un dataset y pospuestos tras coma en
// el otro ("A Laracha" / "Laracha, A", "El Barco" / "Barco, El").
const ARTICLES = new Set([
  "a",
  "as",
  "o",
  "os",
  "el",
  "la",
  "las",
  "les",
  "lo",
  "los",
  "l",
  "es",
  "sa",
  "ses",
]);

/** Claves equivalentes de un nombre de municipio (con y sin artículo). */
export function municipalityNameKeys(rawName: string): string[] {
  const keys = new Set<string>();
  const base = normalizeText(rawName);
  if (!base) return [];
  keys.add(base);

  // "laracha a" -> "a laracha" (la coma desaparece al normalizar).
  const parts = base.split(" ");
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (ARTICLES.has(last)) {
      const moved = [last, ...parts.slice(0, -1)].join(" ");
      keys.add(moved);
      keys.add(parts.slice(0, -1).join(" "));
    }
    const first = parts[0];
    if (ARTICLES.has(first)) {
      keys.add(parts.slice(1).join(" "));
      keys.add([...parts.slice(1), first].join(" "));
    }
  }
  return [...keys].filter(Boolean);
}

const PROVINCE_ALIASES: Record<string, string> = {
  araba: "alava",
  alaba: "alava",
  bizkaia: "vizcaya",
  gipuzkoa: "guipuzcoa",
  nafarroa: "navarra",
  "illes balears": "illes balears",
  "islas baleares": "illes balears",
  balears: "illes balears",
  baleares: "illes balears",
  girona: "girona",
  gerona: "girona",
  lleida: "lleida",
  lerida: "lleida",
  alacant: "alicante",
  castello: "castellon",
  valencia: "valencia",
  ourense: "ourense",
  orense: "ourense",
  "a coruna": "a coruna",
  "la coruna": "a coruna",
  coruna: "a coruna",
};

/** Claves equivalentes de una provincia (nombres bilingües con barra). */
export function provinceKeys(rawProvince: string): string[] {
  const keys = new Set<string>();
  for (const piece of String(rawProvince).split("/")) {
    const normalized = normalizeText(piece);
    if (!normalized) continue;
    keys.add(normalized);
    const alias = PROVINCE_ALIASES[normalized];
    if (alias) keys.add(alias);
  }
  return [...keys];
}

export function normalizePostalCode(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const padded = raw.padStart(5, "0");
  return /^\d{5}$/.test(padded) ? padded : null;
}

export function normalizeIneCode(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const padded = raw.padStart(5, "0");
  return /^\d{5}$/.test(padded) ? padded : null;
}

type Index = {
  byNameProvince: Map<string, Set<string>>;
  byName: Map<string, Set<string>>;
};

function indexDbMunicipalities(municipalities: DbMunicipality[]): Index {
  const byNameProvince = new Map<string, Set<string>>();
  const byName = new Map<string, Set<string>>();
  for (const municipality of municipalities) {
    const nameKeys = municipalityNameKeys(municipality.name);
    const provKeys = provinceKeys(municipality.province);
    for (const nameKey of nameKeys) {
      if (!byName.has(nameKey)) byName.set(nameKey, new Set());
      byName.get(nameKey)!.add(municipality.code);
      for (const provKey of provKeys) {
        const key = `${provKey}::${nameKey}`;
        if (!byNameProvince.has(key)) byNameProvince.set(key, new Set());
        byNameProvince.get(key)!.add(municipality.code);
      }
    }
  }
  return { byNameProvince, byName };
}

/** Resuelve el `code` de la tabla `municipalities` para un municipio del GeoJSON. */
export function matchMunicipalityCode(index: Index, name: string, province: string): string | null {
  const nameKeys = municipalityNameKeys(name);
  const provKeys = provinceKeys(province);
  const hits = new Set<string>();
  for (const nameKey of nameKeys) {
    for (const provKey of provKeys) {
      for (const code of index.byNameProvince.get(`${provKey}::${nameKey}`) ?? []) {
        hits.add(code);
      }
    }
  }
  if (hits.size === 1) return [...hits][0];
  if (hits.size > 1) return null;

  // Fallback: solo si el nombre es único en toda la tabla.
  const nameHits = new Set<string>();
  for (const nameKey of nameKeys) {
    for (const code of index.byName.get(nameKey) ?? []) nameHits.add(code);
  }
  return nameHits.size === 1 ? [...nameHits][0] : null;
}

export type BuildResult = {
  items: PostalAssignment[];
  matched: number;
  unmatched: string[];
  postalCodeCount: number;
};

/**
 * Construye las asignaciones `code -> postal_codes[]` combinando:
 *  - el código postal de cabecera que trae el propio GeoJSON, y
 *  - todos los códigos postales del listado CP↔INE (opcional), de forma que
 *    un CP rural como 15113 (Malpica de Bergantiños) también quede cubierto.
 */
export function buildPostalCodeAssignments(
  geoFeatures: GeoMunicipality[],
  dbMunicipalities: DbMunicipality[],
  postalCodesByIne: Map<string, Set<string>> = new Map(),
): BuildResult {
  const index = indexDbMunicipalities(dbMunicipalities);
  const assignments = new Map<string, Set<string>>();
  const unmatched: string[] = [];

  for (const feature of geoFeatures) {
    const name = String(feature.municipio ?? "").trim();
    const province = String(feature.provincia ?? "").trim();
    if (!name) continue;
    const code = matchMunicipalityCode(index, name, province);
    if (!code) {
      unmatched.push(`${name} (${province})`);
      continue;
    }
    if (!assignments.has(code)) assignments.set(code, new Set());
    const bucket = assignments.get(code)!;

    const headPostalCode = normalizePostalCode(feature.codigo_postal);
    if (headPostalCode) bucket.add(headPostalCode);

    const ine = normalizeIneCode(feature.codigo_ine);
    if (ine) {
      for (const postalCode of postalCodesByIne.get(ine) ?? []) bucket.add(postalCode);
    }
  }

  const items: PostalAssignment[] = [];
  let postalCodeCount = 0;
  for (const [code, codes] of assignments) {
    if (codes.size === 0) continue;
    const sorted = [...codes].sort();
    postalCodeCount += sorted.length;
    items.push({ code, postal_codes: sorted });
  }

  return { items, matched: assignments.size, unmatched, postalCodeCount };
}

/** Agrupa el dataset externo CP↔INE en un índice `INE -> CPs`. */
export function indexPostalCodesByIne(
  rows: Array<Record<string, unknown>>,
): Map<string, Set<string>> {
  const byIne = new Map<string, Set<string>>();
  for (const row of rows) {
    const ine = normalizeIneCode(row["municipio_id"] ?? row["cod_municipio"] ?? row["ine"]);
    const postalCode = normalizePostalCode(row["codigo_postal"] ?? row["cp"]);
    if (!ine || !postalCode) continue;
    if (!byIne.has(ine)) byIne.set(ine, new Set());
    byIne.get(ine)!.add(postalCode);
  }
  return byIne;
}
