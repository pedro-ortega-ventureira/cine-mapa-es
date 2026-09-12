/** Returns a postal code only when it is ready for an exact municipality lookup. */
export function postalCodeForLookup(value: string): string | null {
  const postalCode = value.trim();
  return /^\d{5}$/.test(postalCode) ? postalCode : null;
}
