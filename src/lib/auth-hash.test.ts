import { describe, expect, it } from "vitest";
import { readAuthHashType } from "./auth-hash";

describe("readAuthHashType", () => {
  it("detecta enlaces de recuperación", () => {
    expect(readAuthHashType("#access_token=abc&type=recovery&expires_in=3600")).toBe("recovery");
  });

  it("detecta enlaces de confirmación de alta", () => {
    expect(readAuthHashType("#access_token=abc&type=signup")).toBe("signup");
  });

  it("devuelve null sin hash", () => {
    expect(readAuthHashType("")).toBeNull();
    expect(readAuthHashType(undefined)).toBeNull();
    expect(readAuthHashType("#seccion-mapa")).toBeNull();
  });

  it("marca como other una sesión sin tipo conocido", () => {
    expect(readAuthHashType("#access_token=abc&type=magiclink")).toBe("other");
  });

  it("detecta errores devueltos por el enlace", () => {
    expect(readAuthHashType("#error=access_denied&error_code=otp_expired")).toBe("other");
  });
});

describe("authLinkDestination", () => {
  it("lleva la recuperación que cae en la portada al formulario de contraseña", async () => {
    const { authLinkDestination } = await import("./auth-hash");
    expect(authLinkDestination("recovery", "/")).toBe("/auth-recovery");
  });

  it("lleva la confirmación que cae en la portada al registro", async () => {
    const { authLinkDestination } = await import("./auth-hash");
    expect(authLinkDestination("signup", "/")).toBe("/registro");
  });

  it("no mueve al usuario si ya está en una página que lo gestiona", async () => {
    const { authLinkDestination } = await import("./auth-hash");
    expect(authLinkDestination("recovery", "/registro")).toBeNull();
    expect(authLinkDestination("recovery", "/auth")).toBeNull();
    expect(authLinkDestination("signup", "/registro/")).toBeNull();
  });

  it("no hace nada sin enlace de correo", async () => {
    const { authLinkDestination } = await import("./auth-hash");
    expect(authLinkDestination(null, "/")).toBeNull();
    expect(authLinkDestination("other", "/")).toBeNull();
  });
});
