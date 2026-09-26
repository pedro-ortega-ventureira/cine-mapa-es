import { describe, expect, it } from "vitest";
import { initialRegistrationAuthMode, modeAfterFailedSignIn } from "./registration-auth";

describe("acceso al formulario de alta", () => {
  it("abre el formulario de acceso desde el botón Acceder", () => {
    expect(initialRegistrationAuthMode("signin")).toBe("signin");
  });

  it("abre el formulario de alta cuando no se indica un modo de acceso", () => {
    expect(initialRegistrationAuthMode(undefined)).toBe("signup");
  });

  it("lleva a alta después de que el acceso no encuentra una cuenta", () => {
    expect(modeAfterFailedSignIn("Invalid login credentials")).toBe("signup");
  });

  it("mantiene el acceso ante otros errores", () => {
    expect(modeAfterFailedSignIn("Email not confirmed")).toBe("signin");
  });
});
