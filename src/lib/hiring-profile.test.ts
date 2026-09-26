import { describe, expect, it } from "vitest";
import { TRAVEL_SCOPES } from "./hiring-profile";

describe("perfil orientado a contratación", () => {
  it("usa los cuatro radios de desplazamiento acordados", () => {
    expect(TRAVEL_SCOPES).toEqual(["local", "provincial", "national", "international"]);
  });
});
