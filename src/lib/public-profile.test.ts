import { describe, expect, it } from "vitest";
import { publicHiringDetails } from "./public-profile";

describe("detalles públicos de contratación", () => {
  it("omite todos los detalles de una ficha antigua con campos nulos", () => {
    expect(
      publicHiringDetails({
        availability: null,
        works_remotely: null,
        willing_to_travel: null,
        travel_scope: null,
        has_own_vehicle: null,
        has_cargo_vehicle: null,
        can_drive_van: null,
        social_links: null,
      }),
    ).toEqual([]);
  });

  it("traduce disponibilidad, remoto, desplazamiento y transporte", () => {
    const details = publicHiringDetails({
      availability: "Disponible",
      works_remotely: true,
      willing_to_travel: true,
      travel_scope: "national",
      has_own_vehicle: true,
      has_cargo_vehicle: true,
      can_drive_van: true,
      social_links: null,
    });

    expect(details.map(({ label, value }) => [label, value])).toEqual([
      ["Disponibilidad", "Disponible"],
      ["Trabajo en remoto", "Sí"],
      ["Dispuesto/a a viajar", "Sí"],
      ["Ámbito de desplazamiento", "Nacional"],
      ["Vehículo propio", "Sí"],
      ["Vehículo de carga", "Sí"],
      ["Puede conducir furgoneta", "Sí"],
    ]);
  });

  it("omite enlaces sociales vacíos, inseguros o no permitidos", () => {
    const details = publicHiringDetails({
      availability: null,
      works_remotely: null,
      willing_to_travel: null,
      travel_scope: null,
      has_own_vehicle: null,
      has_cargo_vehicle: null,
      can_drive_van: null,
      social_links: {
        instagram: "https://instagram.com/cineasta",
        youtube: "",
        x: "javascript:alert(1)",
        unknown: "https://example.com",
      },
    });

    expect(details).toEqual([
      {
        key: "social-instagram",
        label: "Instagram",
        value: "Ver perfil",
        href: "https://instagram.com/cineasta",
      },
    ]);
  });
});
