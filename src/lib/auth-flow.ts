// Reglas del flujo email/contraseña: nunca se entra automáticamente a la
// plataforma. Tras registrarse hay que confirmar el email; tras cambiar la
// contraseña recuperada hay que iniciar sesión de nuevo.

export const SIGNUP_CONFIRM_MESSAGE =
  "Revisa tu correo y confirma tu cuenta antes de iniciar sesión.";

export const PASSWORD_UPDATED_MESSAGE =
  "Contraseña actualizada. Inicia sesión con tu nueva contraseña.";

export type PostAuthAction = {
  /** Hay que cerrar cualquier sesión devuelta por el backend. */
  signOut: boolean;
  /** Ruta a la que navegar automáticamente; siempre null por diseño. */
  navigateTo: null;
  message: string;
};

export function afterSignUp(): PostAuthAction {
  return { signOut: true, navigateTo: null, message: SIGNUP_CONFIRM_MESSAGE };
}

export function afterPasswordRecoveryUpdate(): PostAuthAction {
  return { signOut: true, navigateTo: null, message: PASSWORD_UPDATED_MESSAGE };
}

export const ACCOUNT_CONFIRMED_MESSAGE =
  "Cuenta confirmada. Inicia sesión con tu email y tu contraseña.";

/** Al volver del enlace de confirmación tampoco se entra automáticamente. */
export function afterEmailConfirmation(): PostAuthAction {
  return { signOut: true, navigateTo: null, message: ACCOUNT_CONFIRMED_MESSAGE };
}
