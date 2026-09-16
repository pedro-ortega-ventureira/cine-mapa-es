import { describe, expect, it } from "vitest";
import { postalCodeForLookup, postalCodeRegistrationHint } from "./postal-code";

describe("postalCodeForLookup", () => {
  it("accepts an exact five-digit postal code for a server-side municipality lookup", () => {
    expect(postalCodeForLookup(" 15113 ")).toBe("15113");
  });

  it("does not query while the postal code is incomplete or invalid", () => {
    expect(postalCodeForLookup("1511")).toBeNull();
    expect(postalCodeForLookup("15A13")).toBeNull();
  });

  it("explains that an ambiguous postal code requires choosing a municipality", () => {
    expect(postalCodeRegistrationHint).toBe(
      "Añade tu código postal. Si corresponde a más de un municipio, elige tu municipio en la lista.",
    );
  });
});
