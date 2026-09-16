import { describe, expect, it } from "vitest";
import { isValidEmail, RESET_SENT_MESSAGE, validateNewPassword } from "./password-recovery";

describe("recuperación de contraseña", () => {
  it("no revela si la cuenta existe", () => {
    expect(RESET_SENT_MESSAGE).toMatch(/si existe una cuenta/i);
    expect(RESET_SENT_MESSAGE).not.toMatch(/no existe|no encontrada/i);
  });

  it("exige que las dos contraseñas coincidan", () => {
    expect(validateNewPassword("secreto1", "secreto2")).toMatch(/no coinciden/i);
    expect(validateNewPassword("secreto1", "secreto1")).toBeNull();
  });

  it("exige una longitud mínima", () => {
    expect(validateNewPassword("abc", "abc")).toMatch(/6 caracteres/);
  });

  it("valida el email antes de pedir el enlace", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("sin-arroba")).toBe(false);
  });
});
