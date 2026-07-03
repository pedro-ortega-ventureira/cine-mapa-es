import { createServerFn } from "@tanstack/react-start";

/**
 * One-time seed of the municipalities table. Fetches the public dataset
 * from a GitHub gist and upserts all Spanish municipalities.
 * Safe to call multiple times (ON CONFLICT DO NOTHING).
 */
export const seedMunicipalities = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Check if already seeded
  const { count } = await supabaseAdmin
    .from("municipalities")
    .select("*", { count: "exact", head: true });

  if ((count ?? 0) > 5000) {
    return { alreadySeeded: true, count };
  }

  const url =
    "https://gist.githubusercontent.com/soft2help/6f5fd0a2cb6d02da3e87fb61edcc4353/raw/localidades.csv";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch dataset: ${res.status}`);
  const csv = await res.text();

  const slugify = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

  const seen = new Set<string>();
  const rows: Array<{
    code: string;
    name: string;
    province: string;
    autonomous_community: string;
    population: number;
    lat: number | null;
    lng: number | null;
  }> = [];

  for (const line of csv.split("\n")) {
    const parts = line.split(";");
    if (parts.length < 7) continue;
    const [ccaa, prov, name, lat, lng, , pop] = parts;
    const provClean = prov.split("/")[0].trim();
    let code = `${slugify(provClean)}-${slugify(name)}`;
    if (seen.has(code)) code = `${code}-${seen.size}`;
    seen.add(code);
    rows.push({
      code,
      name: name.trim(),
      province: provClean,
      autonomous_community: ccaa.trim(),
      population: parseInt(pop) || 0,
      lat: parseFloat(lat) || null,
      lng: parseFloat(lng) || null,
    });
  }

  // Insert in chunks of 500
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabaseAdmin
      .from("municipalities")
      .upsert(chunk, { onConflict: "code", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    inserted += chunk.length;
  }

  return { inserted, total: rows.length };
});
