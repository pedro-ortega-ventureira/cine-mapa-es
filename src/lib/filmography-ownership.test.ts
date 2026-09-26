import { describe, expect, it } from "vitest";
import { ownsFilmographyItem, validateFilmographyMutation } from "./filmography-ownership";

describe("propiedad de la filmografía", () => {
  it("autoriza elementos del mismo perfil", () => {
    expect(ownsFilmographyItem("profile-1", "profile-1")).toBe(true);
  });

  it("deniega elementos de otro perfil", () => {
    expect(ownsFilmographyItem("profile-1", "profile-2")).toBe(false);
  });

  it("permite actualizar con cinco producciones existentes", () => {
    expect(
      validateFilmographyMutation({
        kind: "update",
        profileId: "profile-1",
        itemProfessionalId: "profile-1",
      }),
    ).toEqual({ ok: true });
  });

  it("impide insertar una sexta producción", () => {
    expect(validateFilmographyMutation({ kind: "insert", existingCount: 5 })).toEqual({
      ok: false,
      reason: "limit_reached",
    });
  });

  it("rechaza un reordenado con IDs ajenos al perfil", () => {
    expect(
      validateFilmographyMutation({
        kind: "reorder",
        requestedIds: ["film-1", "film-foreign"],
        ownedIds: ["film-1", "film-2"],
      }),
    ).toEqual({ ok: false, reason: "not_owned" });
  });

  it("rechaza un reordenado parcial que omite producciones propias", () => {
    expect(
      validateFilmographyMutation({
        kind: "reorder",
        requestedIds: ["film-1"],
        ownedIds: ["film-1", "film-2"],
      }),
    ).toEqual({ ok: false, reason: "incomplete_set" });
  });
});
