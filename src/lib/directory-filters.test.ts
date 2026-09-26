import { describe, expect, it } from "vitest";
import { applyHiringFilters, directorySearchSchema } from "./directory-filters";

class QueryRecorder {
  readonly calls: Array<[string, unknown]> = [];

  eq(column: string, value: unknown) {
    this.calls.push([column, value]);
    return this;
  }
}

describe("filtros de contratación del directorio", () => {
  it("acepta disponibilidad y radio de desplazamiento válidos", () => {
    const search = directorySearchSchema.parse({
      availability: "Disponible",
      travel: "national",
    });

    expect(search.availability).toBe("Disponible");
    expect(search.travel).toBe("national");
  });

  it("conserva remote=false como filtro explícito", () => {
    expect(directorySearchSchema.parse({ remote: "false" }).remote).toBe("false");
  });

  it("descarta valores booleanos de URL inválidos", () => {
    expect(directorySearchSchema.parse({ remote: "yes", vehicle: "1" })).toMatchObject({
      remote: undefined,
      vehicle: undefined,
    });
  });

  it("traduce todos los filtros de contratación a comparaciones exactas", () => {
    const query = new QueryRecorder();
    const search = directorySearchSchema.parse({
      availability: "Disponible",
      remote: "false",
      willing: "true",
      travel: "national",
      vehicle: "true",
      cargo: "false",
      van: "true",
    });

    expect(applyHiringFilters(query, search)).toBe(query);
    expect(query.calls).toEqual([
      ["availability", "Disponible"],
      ["works_remotely", false],
      ["willing_to_travel", true],
      ["travel_scope", "national"],
      ["has_own_vehicle", true],
      ["has_cargo_vehicle", false],
      ["can_drive_van", true],
    ]);
  });
});
