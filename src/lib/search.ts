import { ROLE_SYNONYMS } from "./roleSynonyms";
import { AUTONOMOUS_COMMUNITIES } from "./constants";
import { PROVINCE_NAMES } from "./spain-provinces";

export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const STOPWORDS = new Set([
  "de", "la", "el", "los", "las", "y", "o", "u", "en", "del", "al", "un", "una",
  "unos", "unas", "por", "para", "con", "sin", "que",
]);

export type MunRow = { code: string; name: string; province: string; autonomous_community?: string | null };

export type MunIndex = {
  provinceToCodes: Map<string, string[]>;
  ccaaToCodes: Map<string, string[]>;
  municipalityByName: Map<string, string[]>;
  provinceDisplay: Map<string, string>;
  ccaaDisplay: Map<string, string>;
};

export function buildMunIndex(rows: MunRow[]): MunIndex {
  const provinceToCodes = new Map<string, string[]>();
  const ccaaToCodes = new Map<string, string[]>();
  const municipalityByName = new Map<string, string[]>();
  const provinceDisplay = new Map<string, string>();
  const ccaaDisplay = new Map<string, string>();

  for (const r of rows) {
    if (r.province) {
      const p = normalize(r.province);
      provinceDisplay.set(p, r.province);
      const arr = provinceToCodes.get(p) ?? [];
      arr.push(r.code);
      provinceToCodes.set(p, arr);
    }
    if (r.autonomous_community) {
      const c = normalize(r.autonomous_community);
      ccaaDisplay.set(c, r.autonomous_community);
      const arr = ccaaToCodes.get(c) ?? [];
      arr.push(r.code);
      ccaaToCodes.set(c, arr);
    }
    if (r.name) {
      const n = normalize(r.name);
      const arr = municipalityByName.get(n) ?? [];
      arr.push(r.code);
      municipalityByName.set(n, arr);
    }
  }
  for (const c of AUTONOMOUS_COMMUNITIES) {
    const key = normalize(c);
    if (!ccaaDisplay.has(key)) ccaaDisplay.set(key, c);
  }
  // Igual que con las CCAA: nos asegura reconocer cualquier provincia
  // española aunque la tabla `municipalities` no tenga ese dato bien
  // rellenado para ningún municipio.
  for (const p of PROVINCE_NAMES) {
    const key = normalize(p);
    if (!provinceDisplay.has(key)) provinceDisplay.set(key, p);
  }
  return { provinceToCodes, ccaaToCodes, municipalityByName, provinceDisplay, ccaaDisplay };
}

const NORMALIZED_ROLE_SYNONYMS: Array<{ role: string; phrases: string[] }> = Object.entries(
  ROLE_SYNONYMS,
).map(([role, list]) => ({
  role,
  phrases: [normalize(role), ...list.map(normalize)].filter(Boolean),
}));

export type RoleMatch = { canonical: string; phrase: string };
export type PlaceMatch = { display: string; phrase: string };
export type MunicipalityMatch = { code: string; phrase: string };

export type ParsedQuery = {
  roles: RoleMatch[];
  provinces: PlaceMatch[];
  ccaa: PlaceMatch[];
  municipalities: MunicipalityMatch[];
  freeText: string;
};

export function parseQuery(raw: string, index: MunIndex): ParsedQuery {
  const norm = normalize(raw);
  if (!norm) return { roles: [], provinces: [], ccaa: [], municipalities: [], freeText: "" };

  let remaining = ` ${norm} `;
  const roles = new Map<string, string>(); // canonical -> first matched phrase
  const provinces = new Map<string, string>();
  const ccaa = new Map<string, string>();
  const municipalities: MunicipalityMatch[] = [];
  const seenMuni = new Set<string>();

  const consume = (phrase: string) => {
    if (!phrase) return false;
    const p = ` ${phrase} `;
    const idx = remaining.indexOf(p);
    if (idx === -1) return false;
    remaining = remaining.slice(0, idx) + " " + remaining.slice(idx + p.length);
    return true;
  };

  // 1) Roles — longest phrases first
  const rolePhrases = NORMALIZED_ROLE_SYNONYMS.flatMap((r) =>
    r.phrases.map((phrase) => ({ role: r.role, phrase })),
  ).sort((a, b) => b.phrase.length - a.phrase.length);
  for (const { role, phrase } of rolePhrases) {
    if (consume(phrase)) {
      if (!roles.has(role)) roles.set(role, phrase);
    }
  }

  // 2) CCAA
  const ccaaKeys = [...index.ccaaDisplay.keys()].sort((a, b) => b.length - a.length);
  for (const key of ccaaKeys) {
    if (consume(key)) ccaa.set(index.ccaaDisplay.get(key) ?? key, key);
  }

  // 3) Provinces — se recorre provinceDisplay (no provinceToCodes) para
  // reconocer también las provincias que no tienen ningún municipio
  // vinculado en la tabla `municipalities`.
  const provKeys = [...index.provinceDisplay.keys()].sort((a, b) => b.length - a.length);
  for (const key of provKeys) {
    if (consume(key)) provinces.set(index.provinceDisplay.get(key) ?? key, key);
  }

  // 4) Municipalities (longer names only, to avoid false positives)
  const munKeys = [...index.municipalityByName.keys()]
    .filter((k) => k.length >= 5)
    .sort((a, b) => b.length - a.length);
  for (const key of munKeys) {
    if (consume(key)) {
      for (const c of index.municipalityByName.get(key) ?? []) {
        if (!seenMuni.has(c)) {
          seenMuni.add(c);
          municipalities.push({ code: c, phrase: key });
        }
      }
    }
  }

  // Free text: discard stopwords and very short tokens
  const freeText = remaining
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
    .join(" ");

  return {
    roles: [...roles.entries()].map(([canonical, phrase]) => ({ canonical, phrase })),
    provinces: [...provinces.entries()].map(([display, phrase]) => ({ display, phrase })),
    ccaa: [...ccaa.entries()].map(([display, phrase]) => ({ display, phrase })),
    municipalities,
    freeText,
  };
}
