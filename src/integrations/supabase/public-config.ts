export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
  projectId: string;
};

type PartialSupabasePublicConfig = Partial<SupabasePublicConfig>;

declare global {
  var __SUPABASE_PUBLIC_CONFIG__: SupabasePublicConfig | undefined;
}

function processValue(name: string): string {
  if (typeof process === "undefined") return "";
  return process.env[name] ?? "";
}

export function getSupabasePublicConfig(
  buildConfig: PartialSupabasePublicConfig = {
    url: import.meta.env.VITE_SUPABASE_URL,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID,
  },
  runtimeConfig: PartialSupabasePublicConfig | undefined = globalThis.__SUPABASE_PUBLIC_CONFIG__,
  serverConfig: PartialSupabasePublicConfig = {
    url: processValue("SUPABASE_URL"),
    publishableKey: processValue("SUPABASE_PUBLISHABLE_KEY"),
    projectId: processValue("SUPABASE_PROJECT_ID"),
  },
): SupabasePublicConfig {

  return {
    url: buildConfig.url || runtimeConfig?.url || serverConfig.url || "",
    publishableKey:
      buildConfig.publishableKey ||
      runtimeConfig?.publishableKey ||
      serverConfig.publishableKey ||
      "",
    projectId: buildConfig.projectId || runtimeConfig?.projectId || serverConfig.projectId || "",
  };
}

export function serializeSupabasePublicConfig(config: SupabasePublicConfig): string {
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `globalThis.__SUPABASE_PUBLIC_CONFIG__=${json};`;
}