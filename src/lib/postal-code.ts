/** Returns a postal code only when it is ready for an exact municipality lookup. */
export function postalCodeForLookup(value: string): string | null {
  const postalCode = value.trim();
  return /^\d{5}$/.test(postalCode) ? postalCode : null;
}

export type MunicipalityResolution =
  | { kind: "selected"; municipalityCode: string }
  | { kind: "choice-required" | "no-match"; municipalityCode: null };

export function municipalityResolution(municipalityCodes: string[]): MunicipalityResolution {
  if (municipalityCodes.length === 1) {
    return { kind: "selected", municipalityCode: municipalityCodes[0] };
  }
  if (municipalityCodes.length > 1) {
    return { kind: "choice-required", municipalityCode: null };
  }
  return { kind: "no-match", municipalityCode: null };
}
