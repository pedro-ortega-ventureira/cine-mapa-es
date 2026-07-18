import { ROLE_SYNONYMS } from "./roleSynonyms";
import { AUTONOMOUS_COMMUNITIES } from "./constants";

export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type MunRow = { code: string; name: string; province: string; autonomous_community?: string | null };

export type MunIndex = {
  provinceToCodes: Map<string, string[]>; // normalized province → municipality codes
  ccaaToCodes: Map<string, string[]>;
  municipalityByName: Map<string, string[]>; // normalized name → codes
  provinceDisplay: Map<string, string>; // normalized → original
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
  // ensure canonical CCAA names are also indexed
  for (const c of AUTONOMOUS_COMMUNITIES) {
    const key = normalize(c);
    if (!ccaaDisplay.has(key)) ccaaDisplay.set(key, c);
  }
  return { provinceToCodes, ccaaToCodes, municipalityByName, provinceDisplay, ccaaDisplay };
}

// Precompute normalized role synonyms once
const NORMALIZED_ROLE_SYNONYMS: Array<{ role: string; phrases: string[] }> = Object.entries(
  ROLE_SYNONYMS,
).map(([role, list]) => ({
  role,
  phrases: [normalize(role), ...list.map(normalize)].filter(Boolean),
}));

export type ParsedQuery = {
  roles: string[];
  provinces: string[]; // display names
  ccaa: string[]; // display names
  municipalityCodes: string[];
  freeText: string;
};

export function parseQuery(raw: string, index: MunIndex): ParsedQuery {
  const norm = normalize(raw);
  if (!norm) return { roles: [], provinces: [], ccaa: [], municipalityCodes: [], freeText: "" };

  let remaining = ` ${norm} `;
  const roles = new Set<string>();
  const provinces = new Set<string>();
  const ccaa = new Set<string>();
  const municipalityCodes = new Set<string>();

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
    if (consume(phrase)) roles.add(role);
  }

  // 2) CCAA
  const ccaaKeys = [...index.ccaaDisplay.keys()].sort((a, b) => b.length - a.length);
  for (const key of ccaaKeys) {
    if (consume(key)) ccaa.add(index.ccaaDisplay.get(key) ?? key);
  }

  // 3) Provinces
  const provKeys = [...index.provinceToCodes.keys()].sort((a, b) => b.length - a.length);
  for (const key of provKeys) {
    if (consume(key)) provinces.add(index.provinceDisplay.get(key) ?? key);
  }

  // 4) Municipalities (only match multi-token or long unique names to avoid false positives)
  const munKeys = [...index.municipalityByName.keys()]
    .filter((k) => k.length >= 5)
    .sort((a, b) => b.length - a.length);
  for (const key of munKeys) {
    if (consume(key)) {
      for (const c of index.municipalityByName.get(key) ?? []) municipalityCodes.add(c);
    }
  }

  const freeText = remaining.replace(/\s+/g, " ").trim();
  return {
    roles: [...roles],
    provinces: [...provinces],
    ccaa: [...ccaa],
    municipalityCodes: [...municipalityCodes],
    freeText,
  };
}
