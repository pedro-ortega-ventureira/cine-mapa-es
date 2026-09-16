import { describe, expect, it } from "vitest";
import { isRecoveryParam, validateAuthSearch } from "./auth-search";

describe("validateAuthSearch", () => {
  it("acepta recovery=1 como number (parseo JSON del router)", () => {
    expect(validateAuthSearch({ recovery: 1 })).toEqual({ recovery: true });
  });

  it("acepta recovery=1 como string", () => {
    expect(validateAuthSearch({ recovery: "1" })).toEqual({ recovery: true });
  });

  it("acepta recovery=true (boolean y string)", () => {
    expect(validateAuthSearch({ recovery: true })).toEqual({ recovery: true });
    expect(validateAuthSearch({ recovery: "true" })).toEqual({ recovery: true });
  });

  it("sin recovery devuelve objeto vacío (no canonicaliza a false)", () => {
    expect(validateAuthSearch({})).toEqual({});
    expect(validateAuthSearch({ recovery: undefined })).toEqual({});
  });

  it("valores falsy o inválidos no activan recuperación", () => {
    expect(validateAuthSearch({ recovery: 0 })).toEqual({});
    expect(validateAuthSearch({ recovery: "0" })).toEqual({});
    expect(validateAuthSearch({ recovery: false })).toEqual({});
    expect(validateAuthSearch({ recovery: "false" })).toEqual({});
    expect(validateAuthSearch({ recovery: null })).toEqual({});
  });

  it("isRecoveryParam solo reconoce formas de 1/true", () => {
    expect(isRecoveryParam(1)).toBe(true);
    expect(isRecoveryParam("1")).toBe(true);
    expect(isRecoveryParam(true)).toBe(true);
    expect(isRecoveryParam("true")).toBe(true);
    expect(isRecoveryParam(2)).toBe(false);
    expect(isRecoveryParam("yes")).toBe(false);
  });
});
