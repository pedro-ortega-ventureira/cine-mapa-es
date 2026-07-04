import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const professionalInputSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1),
  full_name: z.string().min(1),
  alias: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  birth_year: z.number().int().nullable().optional(),
  gender: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  social_links: z.record(z.string(), z.any()).optional(),
  municipality_code: z.string().nullable().optional(),
  raw_postal_code: z.string().nullable().optional(),
  primary_role: z.string().nullable().optional(),
  secondary_roles: z.array(z.string()).optional(),
  production_types: z.array(z.string()).optional(),
  bio: z.string().nullable().optional(),
  years_of_experience: z.number().int().nullable().optional(),
  languages: z.array(z.string()).optional(),
  education: z.array(z.any()).optional(),
  awards: z.array(z.any()).optional(),
  availability: z.string().nullable().optional(),
  works_remotely: z.boolean().optional(),
  willing_to_travel: z.boolean().optional(),
  reel_url: z.string().nullable().optional(),
  equipment_owned: z.array(z.string()).optional(),
  union_membership: z.string().nullable().optional(),
  nif_cif: z.string().nullable().optional(),
  verified: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin only");
}

export const upsertProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => professionalInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload: any = { ...data, email: data.email || null };
    const { data: row, error } = data.id
      ? await context.supabase.from("professionals").update(payload).eq("id", data.id).select().single()
      : await context.supabase.from("professionals").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("professionals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), verified: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("professionals")
      .update({ verified: data.verified })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const importRowSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().nullable().optional(),
  raw_postal_code: z.string().nullable().optional(),
  primary_role: z.string().nullable().optional(),
  secondary_roles: z.array(z.string()).optional(),
  bio: z.string().nullable().optional(),
});

export const importProfessionals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      filename: z.string().optional(),
      rows: z.array(importRowSchema),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const slugify = (s: string) =>
      s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

    let inserted = 0, updated = 0, error_count = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < data.rows.length; i++) {
      const r = data.rows[i];
      try {
        // Try to resolve municipality from postal code (first 2 digits = province code, best-effort)
        let municipality_code: string | null = null;
        if (r.raw_postal_code) {
          const cp = r.raw_postal_code.padStart(5, "0");
          const provCode = cp.slice(0, 2);
          // best-effort: look up by CP via municipalities.postal_codes if populated
          const { data: found } = await context.supabase
            .from("municipalities")
            .select("code")
            .contains("postal_codes", [cp])
            .limit(1)
            .maybeSingle();
          if (found) municipality_code = found.code;
          void provCode;
        }

        const baseSlug = slugify(r.full_name);
        const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

        // Upsert by email if present, else insert
        let existing: any = null;
        if (r.email) {
          const { data: e } = await context.supabase
            .from("professionals")
            .select("id")
            .eq("email", r.email)
            .maybeSingle();
          existing = e;
        }

        const payload = {
          full_name: r.full_name,
          email: r.email || null,
          raw_postal_code: r.raw_postal_code || null,
          municipality_code,
          primary_role: r.primary_role || null,
          secondary_roles: r.secondary_roles ?? [],
          bio: r.bio || null,
        };

        if (existing) {
          const { error } = await context.supabase
            .from("professionals")
            .update(payload)
            .eq("id", existing.id);
          if (error) throw error;
          updated++;
        } else {
          const { error } = await context.supabase
            .from("professionals")
            .insert({ ...payload, slug });
          if (error) throw error;
          inserted++;
        }
      } catch (e) {
        error_count++;
        errors.push({ row: i + 1, message: e instanceof Error ? e.message : String(e) });
      }
    }

    await context.supabase.from("import_logs").insert({
      filename: data.filename ?? null,
      rows_inserted: inserted,
      rows_updated: updated,
      rows_error: error_count,
      errors,
      imported_by: context.userId,
    });

    return { inserted, updated, error_count, errors };
  });

export const upsertFilmography = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      professional_id: z.string().uuid(),
      tmdb_id: z.number().int().nullable().optional(),
      title: z.string().min(1),
      original_title: z.string().nullable().optional(),
      type: z.enum(["movie", "tv", "short", "other"]),
      year: z.number().int().nullable().optional(),
      role_in_production: z.string().nullable().optional(),
      credit_type: z.string().nullable().optional(),
      poster_url: z.string().nullable().optional(),
      synopsis: z.string().nullable().optional(),
      tmdb_rating: z.number().nullable().optional(),
      custom_note: z.string().nullable().optional(),
      featured: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...rest } = data;
    const payload: any = rest;
    const { data: row, error } = id
      ? await context.supabase.from("filmography_items").update(payload).eq("id", id).select().single()
      : await context.supabase.from("filmography_items").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteFilmography = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("filmography_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Resolve municipality_code from raw_postal_code for professionals that don't have one yet.
// Ambiguous CPs (multiple municipalities) get tagged "revisar-cp" instead of auto-assigned.
export const backfillMunicipalities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: pending, error } = await context.supabase
      .from("professionals")
      .select("id, raw_postal_code, tags")
      .is("municipality_code", null)
      .not("raw_postal_code", "is", null)
      .limit(2000);
    if (error) throw new Error(error.message);

    let resolved = 0, ambiguous = 0, missing = 0;
    for (const p of pending ?? []) {
      const cp = String((p as any).raw_postal_code || "").padStart(5, "0");
      if (!/^\d{5}$/.test(cp)) { missing++; continue; }
      const { data: matches } = await context.supabase
        .from("municipalities")
        .select("code")
        .contains("postal_codes", [cp])
        .limit(2);
      if (!matches || matches.length === 0) {
        missing++;
        continue;
      }
      if (matches.length > 1) {
        const tags = Array.from(new Set([...(((p as any).tags as string[]) ?? []), "revisar-cp"]));
        await context.supabase.from("professionals").update({ tags }).eq("id", (p as any).id);
        ambiguous++;
        continue;
      }
      await context.supabase
        .from("professionals")
        .update({ municipality_code: matches[0].code })
        .eq("id", (p as any).id);
      resolved++;
    }
    return { checked: pending?.length ?? 0, resolved, ambiguous, missing };
  });

// Verify all currently-unverified professionals (typically the freshly-imported batch).
export const bulkVerifyAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("professionals")
      .update({ verified: true })
      .eq("verified", false)
      .select("id");
    if (error) throw new Error(error.message);
    return { verified: data?.length ?? 0 };
  });

