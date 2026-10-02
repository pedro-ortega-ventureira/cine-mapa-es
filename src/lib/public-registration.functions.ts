import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { locationFromMunicipality } from "@/lib/professional-location";
import { normalizeSocialLinks, TRAVEL_SCOPES, type SocialLinks } from "@/lib/hiring-profile";
import { filmographyInputSchema } from "@/lib/hiring-profile";
import { MAX_FEATURED_PRODUCTIONS, validateFilmographyMutation } from "@/lib/filmography-ownership";
import type { Database } from "@/integrations/supabase/types";

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

type AdminClient = Awaited<ReturnType<typeof getAdminClient>>;
type ProfessionalInsert = Database["public"]["Tables"]["professionals"]["Insert"];
type ProfessionalUpdate = Database["public"]["Tables"]["professionals"]["Update"];
type FilmographyInsert = Database["public"]["Tables"]["filmography_items"]["Insert"];
type FilmographyUpdate = Database["public"]["Tables"]["filmography_items"]["Update"];

const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

// Umbral de la regla de negocio: el directorio solo admite profesionales
// residentes en municipios de menos de 20.000 habitantes.
export const MAX_MUNICIPALITY_POPULATION = 20000;

export const publicProfessionalInputSchema = z.object({
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
  works_remotely: z.boolean().nullable().optional(),
  willing_to_travel: z.boolean().nullable().optional(),
  reel_url: z.string().nullable().optional(),
  equipment_owned: z.array(z.string()).optional(),
  union_membership: z.string().nullable().optional(),
  nif_cif: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  social_links: z
    .unknown()
    .optional()
    .transform((value): SocialLinks => normalizeSocialLinks(value)),
  travel_scope: z.enum(TRAVEL_SCOPES).nullable().optional(),
  has_own_vehicle: z.boolean().nullable().optional(),
  has_cargo_vehicle: z.boolean().nullable().optional(),
  can_drive_van: z.boolean().nullable().optional(),
});

// El municipio es OBLIGATORIO para darse de alta: la base de datos tiene el
// trigger `trg_municipio_menor_20k`, que aborta el INSERT si
// `municipality_code` es NULL o si el municipio supera los 20.000 habitantes.
// El formulario pedía escribir el código a mano en un campo opcional, así que
// cualquier alta terminaba con la excepción cruda del trigger o con un error
// de clave ajena — ningún registro público llegó nunca a completarse.
// Aquí se resuelve el municipio antes de insertar y se devuelven mensajes
// legibles en vez de dejar que reviente Postgres.
// Nota: `postal_codes` está vacío en `municipalities`, así que el buscador del
// formulario cruza por nombre y provincia. Si algún día se puebla (ver
// /api/public/seed-postal-codes), la búsqueda por CP funcionará sin cambios.
async function resolveMunicipality(
  db: AdminClient,
  code: string | null | undefined,
  rawPostalCode: string | null | undefined,
) {
  if (!code) {
    throw new Error(
      "Elige tu municipio de residencia en el buscador: el directorio solo admite municipios de menos de 20.000 habitantes.",
    );
  }
  const { data, error } = await db
    .from("municipalities")
    .select("code,name,province,population,lat,lng,postal_codes")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      "No reconocemos ese municipio. Elígelo del buscador en lugar de escribirlo a mano.",
    );
  }
  if ((data.population ?? 0) >= MAX_MUNICIPALITY_POPULATION) {
    throw new Error(
      `El directorio solo admite profesionales residentes en municipios de menos de ${MAX_MUNICIPALITY_POPULATION.toLocaleString("es-ES")} habitantes. ${data.name} (${data.province}) tiene ${(data.population ?? 0).toLocaleString("es-ES")}.`,
    );
  }
  const postalCode = rawPostalCode?.trim() ?? "";
  if (!/^\d{5}$/.test(postalCode)) {
    throw new Error("El código postal es obligatorio y debe tener 5 dígitos.");
  }
  if (!(data.postal_codes ?? []).includes(postalCode)) {
    throw new Error(
      `El código postal ${postalCode} no corresponde a ${data.name} (${data.province}). Selecciona el municipio indicado por tu código postal.`,
    );
  }
  return data as {
    code: string;
    name: string;
    province: string;
    population: number;
    lat: number | null;
    lng: number | null;
  };
}

/**
 * Imported profiles predate `professionals.user_id`. When the professional
 * signs in, claim the sole legacy profile that uses the same email instead of
 * letting registration create a second one.
 */
async function claimLegacyProfile(db: AdminClient, userId: string, email: unknown) {
  if (typeof email !== "string" || !email.trim()) return null;

  const { data: candidates, error } = await db
    .from("professionals")
    .select("id")
    .is("user_id", null)
    .ilike("email", email.trim())
    .limit(2);
  if (error) throw new Error(error.message);

  // Never guess when an import contains more than one profile with the same
  // contact email; those cases need an administrator to consolidate them.
  if ((candidates?.length ?? 0) !== 1) return null;

  const { data, error: claimError } = await db
    .from("professionals")
    .update({ user_id: userId } as ProfessionalUpdate)
    .eq("id", candidates![0].id)
    .is("user_id", null)
    .select()
    .maybeSingle();
  if (claimError) throw new Error(claimError.message);
  return data;
}

async function hasUnclaimedLegacyProfile(db: AdminClient, email: unknown) {
  if (typeof email !== "string" || !email.trim()) return false;
  const { count, error } = await db
    .from("professionals")
    .select("id", { count: "exact", head: true })
    .is("user_id", null)
    .ilike("email", email.trim());
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

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
    return data ?? claimLegacyProfile(db, context.userId, context.claims.email);
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

    const legacyProfile = await claimLegacyProfile(db, context.userId, context.claims.email);
    if (legacyProfile) {
      throw new Error(
        "Hemos encontrado y vinculado tu perfil anterior. Recarga la página para editarlo.",
      );
    }
    if (await hasUnclaimedLegacyProfile(db, context.claims.email)) {
      throw new Error(
        "Ya existe un perfil importado con este correo. Contacta con soporte para vincularlo y evitar duplicados.",
      );
    }

    const municipality = await resolveMunicipality(
      db,
      data.municipality_code,
      data.raw_postal_code,
    );

    // Un slug puede colisionar (mismo nombre + mismos 4 caracteres al azar) y
    // la columna es UNIQUE NOT NULL, así que se reintenta en vez de devolver
    // un error de clave duplicada al usuario.
    const baseSlug = slugify(data.full_name) || "profesional";

    const basePayload = {
      ...data,
      email: data.email || null,
      social_links: normalizeSocialLinks(data.social_links),
      user_id: context.userId,
      municipality_code: municipality.code,
      ...locationFromMunicipality(municipality),
      // Publicación inmediata y abierta: sin cola de moderación. El municipio
      // ya está validado contra la regla de <20.000 habitantes.
      verified: true,
      active: true,
      exclusion_reason: null,
    };

    let lastError: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      const { data: row, error } = await db
        .from("professionals")
        .insert({ ...basePayload, slug } as ProfessionalInsert)
        .select()
        .single();
      if (!error) return row;
      // 23505 = unique_violation. Si el conflicto es del slug, reintentamos;
      // si es del índice de user_id, es que ya existe perfil para esta cuenta.
      if (error.code === "23505" && String(error.message).includes("slug")) {
        lastError = error.message;
        continue;
      }
      if (error.code === "23505") {
        throw new Error("Ya tienes un perfil registrado. Edítalo en lugar de crear uno nuevo.");
      }
      throw new Error(error.message);
    }
    throw new Error(lastError ?? "No se pudo generar una URL única para tu perfil.");
  });

export const updateMyProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => publicProfessionalInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await getAdminClient();

    const { data: existing, error: findError } = await db
      .from("professionals")
      .select("id, verified")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (findError) throw new Error(findError.message);
    if (!existing) throw new Error("No tienes un perfil todavía. Regístrate primero.");

    const municipality = await resolveMunicipality(
      db,
      data.municipality_code,
      data.raw_postal_code,
    );

    const payload = {
      ...data,
      email: data.email || null,
      social_links: normalizeSocialLinks(data.social_links),
      municipality_code: municipality.code,
      ...locationFromMunicipality(municipality),
      verified: true,
      active: true,
      exclusion_reason: null,
    };
    const { data: row, error } = await db
      .from("professionals")
      .update(payload as ProfessionalUpdate)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const filmographyUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  item: filmographyInputSchema,
});

const filmographyIdSchema = z.object({ id: z.string().uuid() });

const filmographyReorderSchema = z.object({
  item_ids: z
    .array(z.string().uuid())
    .max(MAX_FEATURED_PRODUCTIONS)
    .refine((ids) => new Set(ids).size === ids.length, "No se pueden repetir producciones"),
});

async function getOwnedProfessionalId(db: AdminClient, userId: string): Promise<string> {
  const { data, error } = await db
    .from("professionals")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No tienes un perfil todavía. Regístrate primero.");
  return data.id;
}

export const getMyFilmography = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await getAdminClient();
    const professionalId = await getOwnedProfessionalId(db, context.userId);
    const { data, error } = await db
      .from("filmography_items")
      .select("*")
      .eq("professional_id", professionalId)
      .eq("featured", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertMyFilmographyItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filmographyUpsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await getAdminClient();
    const professionalId = await getOwnedProfessionalId(db, context.userId);

    if (data.id) {
      const { data: existing, error: findError } = await db
        .from("filmography_items")
        .select("professional_id")
        .eq("id", data.id)
        .eq("featured", true)
        .maybeSingle();
      if (findError) throw new Error(findError.message);
      if (
        !existing ||
        !validateFilmographyMutation({
          kind: "update",
          profileId: professionalId,
          itemProfessionalId: existing.professional_id,
        }).ok
      ) {
        throw new Error("No se ha encontrado esa producción en tu perfil.");
      }

      const { data: row, error } = await db
        .from("filmography_items")
        .update(data.item as FilmographyUpdate)
        .eq("id", data.id)
        .eq("professional_id", professionalId)
        .eq("featured", true)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }

    const { count, error: countError } = await db
      .from("filmography_items")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", professionalId)
      .eq("featured", true);
    if (countError) throw new Error(countError.message);
    if (!validateFilmographyMutation({ kind: "insert", existingCount: count ?? 0 }).ok) {
      throw new Error(`Solo puedes destacar ${MAX_FEATURED_PRODUCTIONS} producciones.`);
    }

    const payload: FilmographyInsert = {
      ...data.item,
      professional_id: professionalId,
      featured: true,
    };
    const { data: row, error } = await db
      .from("filmography_items")
      .insert(payload)
      .select()
      .single();
    if (error) {
      if (error.message.includes("Máximo de 5 producciones destacadas")) {
        throw new Error(`Solo puedes destacar ${MAX_FEATURED_PRODUCTIONS} producciones.`);
      }
      throw new Error(error.message);
    }
    return row;
  });

export const deleteMyFilmographyItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filmographyIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await getAdminClient();
    const professionalId = await getOwnedProfessionalId(db, context.userId);
    const { data: deleted, error } = await db
      .from("filmography_items")
      .delete()
      .eq("id", data.id)
      .eq("professional_id", professionalId)
      .eq("featured", true)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) throw new Error("No se ha encontrado esa producción en tu perfil.");
    return { id: deleted.id };
  });

export const reorderMyFilmography = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filmographyReorderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await getAdminClient();
    const professionalId = await getOwnedProfessionalId(db, context.userId);
    const { data: ownedItems, error: findError } = await db
      .from("filmography_items")
      .select("id")
      .eq("professional_id", professionalId)
      .eq("featured", true);
    if (findError) throw new Error(findError.message);
    if (
      !validateFilmographyMutation({
        kind: "reorder",
        requestedIds: data.item_ids,
        ownedIds: (ownedItems ?? []).map((item) => item.id),
      }).ok
    ) {
      throw new Error("No se pueden reordenar producciones de otro perfil.");
    }

    const { error } = await db.rpc("reorder_featured_filmography", {
      _professional_id: professionalId,
      _item_ids: data.item_ids,
    });
    if (error) throw new Error(error.message);
    return { item_ids: data.item_ids };
  });
