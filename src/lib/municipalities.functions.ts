import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export const seedMunicipalities = createServerFn({ method: "POST" }).handler(async () => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { count } = await supabase
    .from("municipalities")
    .select("*", { count: "exact", head: true });
  if ((count ?? 0) > 5000) return { alreadySeeded: true, count };

  const res = await fetch(
    "https://gist.githubusercontent.com/soft2help/6f5fd0a2cb6d02da3e87fb61edcc4353/raw/localidades.csv",
  );
  if (!res.ok) throw new Error(`Dataset fetch failed: ${res.status}`);
  const csv = await res.text();

  const slugify = (s: string) =>
    s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

  const seen = new Set<string>();
  const rows: any[] = [];
  for (const line of csv.split("\n")) {
    const p = line.split(";");
    if (p.length < 7) continue;
    const [ccaa, prov, name, lat, lng, , pop] = p;
    const provClean = prov.split("/")[0].trim();
    let code = `${slugify(provClean)}-${slugify(name)}`;
    if (seen.has(code)) code = `${code}-${seen.size}`;
    seen.add(code);
    rows.push({
      code, name: name.trim(), province: provClean,
      autonomous_community: ccaa.trim(),
      population: parseInt(pop) || 0,
      lat: parseFloat(lat) || null,
      lng: parseFloat(lng) || null,
    });
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { data, error } = await supabase.rpc("seed_municipalities_batch" as any, {
      _payload: chunk,
    });
    if (error) throw new Error(error.message);
    inserted += (data as number) ?? 0;
  }

  return { inserted, total: rows.length };
});

