import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Self-service registration for professionals. Unlike professionals.functions.ts,
// there is NO assertAdmin() here — any authenticated user may create/update
// exactly one professional row of their own, identified by user_id. We still
// use the service-role client (not the caller's own JWT client) for the same
// reason the admin functions do: email/phone/nif_cif columns have no GRANT
// SELECT for `authenticated`, so a plain client can't even read back what it
// just wrote. Ownership is enforced explicitly below by filtering/checking
// user_id against context.userId (which comes from a verified JWT, not from
// client input), plus defense-in-depth RLS policies added in the
// 20260719120000 migration.

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const publicProfessionalInputSchema = z.object({
  full_name: z.string().min(1),
  alias: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  birth_year: z.number().int().nullable().optional(),
  gender: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  municipality_code: z.string().nullable().optional(),
  raw_postal_code: z.string().nullable().optional(),
  primary_role: z.string().nullable().optional(),
  secondary_roles: z.array(z.string()).optional(),
  production_types: z.array(z.string()).optional(),
  bio: z.string().nullable().optional(),
  years_of_experience: z.number().int().nullable().optional(),
  languages: z.array(z.string()).optional(),
  availability: z.string().nullable().optional(),
  works_remotely: z.boolean().optional(),
  willing_to_travel: z.boolean().optional(),
  reel_url: z.string().nullable().optional(),
  equipment_owned: z.array(z.string()).optional(),
  union_membership: z.string().nullable().optional(),
  nif_cif: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export const getMyProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await getAdminClient();
    const { data, error } = await db
      .from("professionals")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  });

export const registerProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => publicProfessionalInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await getAdminClient();

    const { data: existing } = await db
      .from("professionals")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) {
      throw new Error("Ya tienes un perfil registrado. Edítalo en lugar de crear uno nuevo.");
    }

    const baseSlug = slugify(data.full_name) || "profesional";
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    const payload: any = {
      ...data,
      email: data.email || null,
      slug,
      user_id: context.userId,
      // Publicación inmediata y abierta: sin cola de moderación.
      verified: true,
    };
    const { data: row, error } = await db
      .from("professionals")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateMyProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => publicProfessionalInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await getAdminClient();

    const { data: existing, error: findError } = await db
      .from("professionals")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (findError) throw new Error(findError.message);
    if (!existing) throw new Error("No tienes un perfil todavía. Regístrate primero.");

    const payload: any = { ...data, email: data.email || null };
    const { data: row, error } = await db
      .from("professionals")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
