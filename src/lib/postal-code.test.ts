import { describe, expect, it } from "vitest";
import { municipalityResolution, postalCodeForLookup } from "./postal-code";

describe("postalCodeForLookup", () => {
  it("accepts an exact five-digit postal code for a server-side municipality lookup", () => {
    expect(postalCodeForLookup(" 15113 ")).toBe("15113");
  });

  it("does not query while the postal code is incomplete or invalid", () => {
    expect(postalCodeForLookup("1511")).toBeNull();
    expect(postalCodeForLookup("15A13")).toBeNull();
  });

  it("selects the municipality when the postal code has exactly one match", () => {
    expect(municipalityResolution(["15001"])).toEqual({
      kind: "selected",
      municipalityCode: "15001",
    });
  });

  it("requires a choice when municipalities share the postal code", () => {
    expect(municipalityResolution(["15001", "15002"])).toEqual({
      kind: "choice-required",
      municipalityCode: null,
    });
  });

  it("rejects a postal code with no eligible municipality", () => {
    expect(municipalityResolution([])).toEqual({
      kind: "no-match",
      municipalityCode: null,
    });
  });
});
