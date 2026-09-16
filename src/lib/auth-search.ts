/**
 * Validación del parámetro `recovery` de /auth.
 *
 * TanStack Router parsea los query params con JSON: `?recovery=1` llega como
 * number 1 (no string "1"), y según el parser también puede llegar boolean.
 * Si la validación no lo reconoce y devuelve `false`, el router canonicaliza
 * la URL a `?recovery=false` (redirect 307) y beforeLoad saltaría a /admin
 * con una sesión de recuperación activa. Por eso hay que aceptar todas las
 * formas y devolver `undefined` cuando no aplica (el param se elimina).
 */
export function isRecoveryParam(raw: unknown): boolean {
  return raw === 1 || raw === "1" || raw === true || raw === "true";
}

export type AuthSearch = { recovery?: boolean };

export function validateAuthSearch(search: Record<string, unknown>): AuthSearch {
  return isRecoveryParam(search["recovery"]) ? { recovery: true } : {};
}
