// Los enlaces de email de Supabase vuelven a la web con un hash del tipo
// #access_token=...&type=recovery|signup|magiclink.
// El cliente de Supabase procesa y BORRA ese hash de forma asíncrona, así que
// hay que leerlo de manera síncrona al cargar el módulo: si esperamos al
// evento onAuthStateChange puede haberse emitido antes de montar React
// (carrera que dejaba al usuario dentro de la plataforma sin confirmar o sin
// ver el formulario de nueva contraseña).

export type AuthLinkType = "recovery" | "signup" | "other" | null;

export function readAuthHashType(hash: string | undefined | null): AuthLinkType {
  if (!hash) return null;
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  if (!params.has("access_token") && !params.has("error") && !params.has("type")) return null;
  const type = params.get("type");
  if (type === "recovery") return "recovery";
  if (type === "signup" || type === "email_change" || type === "invite") return "signup";
  return "other";
}

export const INITIAL_AUTH_LINK_TYPE: AuthLinkType =
  typeof window === "undefined" ? null : readAuthHashType(window.location.hash);

/**
 * Si el enlace del correo aterriza en una página que no sabe gestionarlo
 * (por ejemplo la portada), hay que llevar al usuario a la página correcta.
 * Devuelve null cuando la página actual ya sabe gestionarlo.
 */
export function authLinkDestination(
  type: AuthLinkType,
  pathname: string,
): "/auth-recovery" | "/registro" | null {
  if (type !== "recovery" && type !== "signup") return null;
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/registro" || path === "/auth") return null;
  return type === "recovery" ? "/auth-recovery" : "/registro";
}
