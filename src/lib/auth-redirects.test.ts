import { describe, expect, it } from "vitest";
import {
  isProductionAuthRedirect,
  PASSWORD_RECOVERY_REDIRECT_URL,
  PRODUCTION_ORIGIN,
  SIGNUP_CONFIRM_REDIRECT_URL,
} from "./auth-redirects";

const authRedirects = [PASSWORD_RECOVERY_REDIRECT_URL, SIGNUP_CONFIRM_REDIRECT_URL];

describe("destinos de los enlaces de correo", () => {
  it("nunca apuntan a localhost", () => {
    for (const url of authRedirects) {
      expect(url.toLowerCase()).not.toContain("localhost");
      expect(url.toLowerCase()).not.toContain("127.0.0.1");
    }
  });

  it("usan siempre el origen de producción", () => {
    for (const url of authRedirects) {
      expect(new URL(url).origin).toBe("https://cine-mapa-es.lovable.app");
      expect(isProductionAuthRedirect(url)).toBe(true);
    }
  });

  it("rechaza orígenes distintos del de producción", () => {
    expect(isProductionAuthRedirect("http://localhost:3000/auth?recovery=true")).toBe(false);
    expect(isProductionAuthRedirect("https://preview--cine-mapa-es.lovable.app/auth")).toBe(false);
    expect(isProductionAuthRedirect("no-es-una-url")).toBe(false);
  });

  it("la recuperación lleva a /auth?recovery=true, nunca a /registro", () => {
    const url = new URL(PASSWORD_RECOVERY_REDIRECT_URL);
    expect(url.pathname).toBe("/auth");
    expect(url.searchParams.get("recovery")).toBe("true");
    expect(PASSWORD_RECOVERY_REDIRECT_URL).not.toContain("/registro");
  });

  it("el origen de producción no lleva barra final ni ruta", () => {
    expect(PRODUCTION_ORIGIN).toBe(new URL(PRODUCTION_ORIGIN).origin);
  });
});
