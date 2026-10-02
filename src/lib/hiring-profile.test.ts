import { describe, expect, it } from "vitest";
import {
  filmographyInputSchema,
  formBooleanToNullable,
  normalizeSocialLinks,
  rowToHiringFormFields,
  TRAVEL_SCOPES,
} from "./hiring-profile";

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
  ])("rechaza producciones con %s", (...args: [{ title: string; year?: number; role_in_production: string }, string]) => {
    const [input] = args;
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

  it("convierte valores nulos de contratación en campos vacíos", () => {
    expect(
      rowToHiringFormFields({
        social_links: null,
        travel_scope: null,
        has_own_vehicle: null,
        has_cargo_vehicle: null,
        can_drive_van: null,
      }),
    ).toEqual({
      instagram: "",
      tiktok: "",
      linkedin: "",
      facebook: "",
      x: "",
      vimeo: "",
      youtube: "",
      travel_scope: "",
      has_own_vehicle: "",
      has_cargo_vehicle: "",
      can_drive_van: "",
    });
  });

  it("restaura literalmente redes y movilidad guardadas", () => {
    expect(
      rowToHiringFormFields({
        social_links: {
          instagram: "https://instagram.com/cineasta",
          vimeo: "https://vimeo.com/cineasta",
        },
        travel_scope: "international",
        has_own_vehicle: true,
        has_cargo_vehicle: false,
        can_drive_van: true,
      }),
    ).toMatchObject({
      instagram: "https://instagram.com/cineasta",
      vimeo: "https://vimeo.com/cineasta",
      travel_scope: "international",
      has_own_vehicle: "true",
      has_cargo_vehicle: "false",
      can_drive_van: "true",
    });
  });

  it("conserva la diferencia entre no indicado, sí y no", () => {
    expect(formBooleanToNullable("")).toBeNull();
    expect(formBooleanToNullable("true")).toBe(true);
    expect(formBooleanToNullable("false")).toBe(false);
  });
});
