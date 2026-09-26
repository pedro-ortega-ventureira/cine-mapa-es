import { describe, expect, it } from "vitest";
import { filmographyInputSchema, normalizeSocialLinks, TRAVEL_SCOPES } from "./hiring-profile";

describe("perfil orientado a contratación", () => {
  it("usa los cuatro radios de desplazamiento acordados", () => {
    expect(TRAVEL_SCOPES).toEqual(["local", "provincial", "national", "international"]);
  });

  it("elimina redes vacías y conserva una URL HTTPS válida", () => {
    expect(
      normalizeSocialLinks({
        instagram: "   ",
        linkedin: "https://www.linkedin.com/in/directora-rural",
      }),
    ).toEqual({ linkedin: "https://www.linkedin.com/in/directora-rural" });
  });

  it("rechaza protocolos inseguros en las redes sociales", () => {
    expect(() => normalizeSocialLinks({ x: "javascript:alert(1)" })).toThrow();
  });

  it("acepta una producción con título, año y rol desempeñado", () => {
    const production = filmographyInputSchema.parse({
      title: "La senda",
      year: 2025,
      type: "movie",
      role_in_production: "Dirección de fotografía",
      countries: ["España", "Portugal"],
      genre: "Drama",
      external_url: "https://example.com/la-senda",
      poster_url: "https://example.com/la-senda.jpg",
      sort_order: 0,
    });

    expect(production.title).toBe("La senda");
    expect(production.role_in_production).toBe("Dirección de fotografía");
  });

  it.each([
    [{ title: "", year: 2025, role_in_production: "Montaje" }, "título vacío"],
    [{ title: "La senda", role_in_production: "Montaje" }, "año ausente"],
    [{ title: "La senda", year: 2025, role_in_production: "  " }, "rol vacío"],
  ])("rechaza producciones con %s", (input) => {
    expect(filmographyInputSchema.safeParse(input).success).toBe(false);
  });

  it("descarta países vacíos de una producción", () => {
    const production = filmographyInputSchema.parse({
      title: "La senda",
      year: 2025,
      role_in_production: "Montaje",
      countries: ["España", "", "   ", "Portugal"],
    });

    expect(production.countries).toEqual(["España", "Portugal"]);
  });
});
