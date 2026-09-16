/** Returns a postal code only when it is ready for an exact municipality lookup. */
export function postalCodeForLookup(value: string): string | null {
  const postalCode = value.trim();
  return /^\d{5}$/.test(postalCode) ? postalCode : null;
}

export const postalCodeRegistrationHint =
  "Añade tu código postal. Si corresponde a más de un municipio, elige tu municipio en la lista.";
