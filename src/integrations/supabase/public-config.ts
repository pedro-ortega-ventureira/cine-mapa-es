export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
  projectId: string;
};

declare global {
  var __SUPABASE_PUBLIC_CONFIG__: SupabasePublicConfig | undefined;
}

function processValue(name: string): string {
  if (typeof process === "undefined") return "";
  return process.env[name] ?? "";
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const runtimeConfig = globalThis.__SUPABASE_PUBLIC_CONFIG__;

  return {
    url:
      import.meta.env.VITE_SUPABASE_URL ||
      runtimeConfig?.url ||
      processValue("SUPABASE_URL"),
    publishableKey:
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      runtimeConfig?.publishableKey ||
      processValue("SUPABASE_PUBLISHABLE_KEY"),
    projectId:
      import.meta.env.VITE_SUPABASE_PROJECT_ID ||
      runtimeConfig?.projectId ||
      processValue("SUPABASE_PROJECT_ID"),
  };
}

export function serializeSupabasePublicConfig(config: SupabasePublicConfig): string {
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `globalThis.__SUPABASE_PUBLIC_CONFIG__=${json};`;
}