import { describe, expect, it } from "vitest";
import {
  buildPostalCodeAssignments,
  indexPostalCodesByIne,
  municipalityNameKeys,
  normalizePostalCode,
  provinceKeys,
} from "./postal-codes-geo";

const db = [
  { code: "a-coruna-malpica-de-bergantinos", name: "Malpica de Bergantiños", province: "A Coruña" },
  { code: "a-coruna-a-laracha", name: "Laracha, A", province: "A Coruña" },
  { code: "alicante-agost", name: "Agost", province: "Alicante" },
  { code: "vizcaya-bermeo", name: "Bermeo", province: "Vizcaya" },
];

describe("normalización", () => {
  it("ignora acentos y mayúsculas en los nombres", () => {
    expect(municipalityNameKeys("MALPICA DE BERGANTIÑOS")).toContain("malpica de bergantinos");
  });

  it("equipara el artículo antepuesto y pospuesto", () => {
    expect(municipalityNameKeys("Laracha, A")).toContain("a laracha");
    expect(municipalityNameKeys("A LARACHA")).toContain("laracha");
  });

  it("acepta los nombres bilingües de provincia", () => {
    expect(provinceKeys("ALACANT/ALICANTE")).toContain("alicante");
    expect(provinceKeys("BIZKAIA")).toContain("vizcaya");
  });

  it("completa los códigos postales a cinco dígitos", () => {
    expect(normalizePostalCode(15113)).toBe("15113");
    expect(normalizePostalCode("1113")).toBe("01113");
    expect(normalizePostalCode("abc")).toBeNull();
  });
});

describe("buildPostalCodeAssignments", () => {
  const geo = [
    {
      codigo_ine: "15043",
      municipio: "MALPICA DE BERGANTIÑOS",
      provincia: "A CORUÑA",
      codigo_postal: "15111",
    },
    { codigo_ine: "15041", municipio: "A LARACHA", provincia: "A CORUÑA", codigo_postal: "15145" },
    {
      codigo_ine: "03002",
      municipio: "AGOST",
      provincia: "ALACANT/ALICANTE",
      codigo_postal: "03698",
    },
    {
      codigo_ine: "99999",
      municipio: "MUNICIPIO INEXISTENTE",
      provincia: "SORIA",
      codigo_postal: "42000",
    },
  ];

  it("añade los códigos postales del listado externo, no solo el de cabecera", () => {
    const byIne = indexPostalCodesByIne([
      { codigo_postal: 15113, municipio_id: 15043 },
      { codigo_postal: "15111", municipio_id: "15043" },
    ]);
    const result = buildPostalCodeAssignments(geo, db, byIne);
    const malpica = result.items.find((i) => i.code === "a-coruna-malpica-de-bergantinos");
    expect(malpica?.postal_codes).toEqual(["15111", "15113"]);
  });

  it("cruza artículos y provincias bilingües", () => {
    const result = buildPostalCodeAssignments(geo, db);
    expect(result.items.find((i) => i.code === "a-coruna-a-laracha")?.postal_codes).toEqual([
      "15145",
    ]);
    expect(result.items.find((i) => i.code === "alicante-agost")?.postal_codes).toEqual(["03698"]);
  });

  it("no inventa coincidencias para municipios desconocidos", () => {
    const result = buildPostalCodeAssignments(geo, db);
    expect(result.unmatched).toEqual(["MUNICIPIO INEXISTENTE (SORIA)"]);
    expect(result.items).toHaveLength(3);
  });
});
