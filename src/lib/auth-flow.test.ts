import { describe, expect, it } from "vitest";
import {
  afterPasswordRecoveryUpdate,
  afterSignUp,
  PASSWORD_UPDATED_MESSAGE,
  SIGNUP_CONFIRM_MESSAGE,
} from "./auth-flow";

describe("flujo email/contraseña sin navegación automática", () => {
  it("tras registrarse cierra la sesión y no navega a ningún panel", () => {
    const action = afterSignUp();
    expect(action.signOut).toBe(true);
    expect(action.navigateTo).toBeNull();
    expect(action.message).toBe(SIGNUP_CONFIRM_MESSAGE);
    expect(action.message).toMatch(/confirma tu cuenta/i);
  });

  it("tras cambiar la contraseña recuperada cierra la sesión y no navega", () => {
    const action = afterPasswordRecoveryUpdate();
    expect(action.signOut).toBe(true);
    expect(action.navigateTo).toBeNull();
    expect(action.message).toBe(PASSWORD_UPDATED_MESSAGE);
    expect(action.message).toMatch(/inicia sesión/i);
  });
});
