/**
 * Destinos de los enlaces de correo de autenticación.
 *
 * Deben ser absolutos y apuntar SIEMPRE al dominio de producción: si se usa
 * `window.location.origin`, el enlace del correo hereda el dominio desde el que
 * se pidió (preview, localhost, etc.) y el usuario acaba en un sitio que no es
 * el suyo. Al ser una constante compartida, /auth y /registro no pueden
 * divergir.
 */
export const PRODUCTION_ORIGIN = "https://cine-mapa-es.lovable.app";

/** Única página que muestra el formulario de nueva contraseña. */
export const PASSWORD_RECOVERY_REDIRECT_URL = `${PRODUCTION_ORIGIN}/auth?recovery=true`;

/** Destino tras confirmar la cuenta desde el correo de alta. */
export const SIGNUP_CONFIRM_REDIRECT_URL = `${PRODUCTION_ORIGIN}/registro`;

export function isProductionAuthRedirect(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.origin === PRODUCTION_ORIGIN;
}
