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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

// Umbral de la regla de negocio: el directorio solo admite profesionales
// residentes en municipios de menos de 20.000 habitantes.
export const MAX_MUNICIPALITY_POPULATION = 20000;

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

// El municipio es OBLIGATORIO para darse de alta: la base de datos tiene el
// trigger `trg_municipio_menor_20k`, que aborta el INSERT si
// `municipality_code` es NULL o si el municipio supera los 20.000 habitantes.
// El formulario pedía escribir el código a mano en un campo opcional, así que
// cualquier alta terminaba con la excepción cruda del trigger o con un error
// de clave ajena — ningún registro público llegó nunca a completarse.
// Aquí se resuelve el municipio antes de insertar y se devuelven mensajes
// legibles en vez de dejar que reviente Postgres.
// Nota: `postal_codes` ya está poblado en `municipalities` (11.005 códigos, 1,8
// de media por municipio), así que el buscador del formulario cruza también por
// CP. Ojo: el listado es incompleto —11 municipios no tienen ninguno y 2.271
// códigos aparecen en más de un municipio—, de modo que el autorrelleno por CP
// sólo acierta cuando el código identifica un único municipio; en el resto de
// casos hay que elegir a mano.
async function resolveMunicipality(db: any, code: string | null | undefined) {
  if (!code) {
    throw new Error(
      "Elige tu municipio de residencia en el buscador: el directorio solo admite municipios de menos de 20.000 habitantes.",
    );
  }
  const { data, error } = await db
    .from("municipalities")
    .select("code,name,province,population")
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
  return data as { code: string; name: string; province: string; population: number };
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

    const municipality = await resolveMunicipality(db, data.municipality_code);

    // Un slug puede colisionar (mismo nombre + mismos 4 caracteres al azar) y
    // la columna es UNIQUE NOT NULL, así que se reintenta en vez de devolver
    // un error de clave duplicada al usuario.
    const baseSlug = slugify(data.full_name) || "profesional";

    const basePayload: any = {
      ...data,
      email: data.email || null,
      user_id: context.userId,
      municipality_code: municipality.code,
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
        .insert({ ...basePayload, slug })
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

    const municipality = await resolveMunicipality(db, data.municipality_code);

    const payload: any = {
      ...data,
      email: data.email || null,
      municipality_code: municipality.code,
      verified: true,
      active: true,
      exclusion_reason: null,
    };
    const { data: row, error } = await db
      .from("professionals")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
