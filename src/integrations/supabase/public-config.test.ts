import { afterEach, describe, expect, it } from "vitest";
import {
  getSupabasePublicConfig,
  serializeSupabasePublicConfig,
} from "./public-config";

const originalConfig = globalThis.__SUPABASE_PUBLIC_CONFIG__;

afterEach(() => {
  globalThis.__SUPABASE_PUBLIC_CONFIG__ = originalConfig;
});

describe("Supabase public config", () => {
  it("uses the browser global when build values are unavailable", () => {
    globalThis.__SUPABASE_PUBLIC_CONFIG__ = {
      url: "https://public.example",
      publishableKey: "sb_publishable_test",
      projectId: "public-project",
    };

    expect(
      getSupabasePublicConfig({}, globalThis.__SUPABASE_PUBLIC_CONFIG__, {}),
    ).toEqual(globalThis.__SUPABASE_PUBLIC_CONFIG__);
  });

  it("escapes HTML-significant opening brackets in the inline script", () => {
    const serialized = serializeSupabasePublicConfig({
      url: "https://public.example/<script>alert(1)</script>",
      publishableKey: "sb_publishable_test</script>",
      projectId: "public-project",
    });

    expect(serialized).not.toContain("<");
    expect(serialized).toContain("\\u003cscript>");
  });
});