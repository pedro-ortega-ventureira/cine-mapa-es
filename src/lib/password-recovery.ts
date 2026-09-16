// Recuperación de contraseña con email/contraseña de Supabase.
// Nunca se revela si el email existe: el mensaje es siempre el mismo.

export const RESET_SENT_MESSAGE =
  "Si existe una cuenta con ese email, te hemos enviado un enlace para cambiar la contraseña. Revisa también el correo no deseado.";

export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < 6) return "La contraseña debe tener al menos 6 caracteres";
  if (password !== confirmation) return "Las contraseñas no coinciden";
  return null;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
