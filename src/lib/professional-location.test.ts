import { describe, expect, it } from "vitest";
import { locationFromMunicipality } from "./professional-location";

describe("locationFromMunicipality", () => {
  it("uses the selected municipality coordinates in the public map payload", () => {
    expect(
      locationFromMunicipality({
        name: "Cee",
        province: "A Coruña",
        lat: 42.954,
        lng: -9.188,
      }),
    ).toEqual({
      geo_lat: 42.954,
      geo_lng: -9.188,
      geo_accuracy: "exact",
      geo_municipality_name: "Cee",
      geo_province: "A Coruña",
    });
  });

  it("does not claim a map position when the municipality has no coordinates", () => {
    expect(
      locationFromMunicipality({ name: "Sin coordenadas", province: "León", lat: null, lng: null }),
    ).toEqual({
      geo_lat: null,
      geo_lng: null,
      geo_accuracy: "none",
      geo_municipality_name: "Sin coordenadas",
      geo_province: "León",
    });
  });
});
