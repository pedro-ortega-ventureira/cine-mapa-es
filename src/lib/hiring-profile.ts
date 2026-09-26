import { z } from "zod";

export const TRAVEL_SCOPES = ["local", "provincial", "national", "international"] as const;

export type TravelScope = (typeof TRAVEL_SCOPES)[number];

export const SOCIAL_NETWORKS = [
  "instagram",
  "tiktok",
  "linkedin",
  "facebook",
  "x",
  "vimeo",
  "youtube",
] as const;

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];
export type SocialLinks = Partial<Record<SocialNetwork, string>>;

const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "La URL debe usar HTTP o HTTPS");

const socialLinksSchema = z.object(
  Object.fromEntries(
    SOCIAL_NETWORKS.map((network) => [network, httpUrlSchema.optional()]),
  ) as Record<SocialNetwork, z.ZodOptional<typeof httpUrlSchema>>,
);

export function normalizeSocialLinks(input: unknown): SocialLinks {
  if (input == null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Las redes sociales deben tener un formato válido");
  }

  const withoutEmptyValues = Object.fromEntries(
    SOCIAL_NETWORKS.flatMap((network) => {
      const value = (input as Record<string, unknown>)[network];
      return typeof value === "string" && value.trim() === "" ? [] : [[network, value]];
    }).filter(([, value]) => value !== undefined),
  );

  return socialLinksSchema.parse(withoutEmptyValues);
}

const optionalHttpUrlSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  httpUrlSchema.nullable().optional(),
);

export const filmographyInputSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio"),
  year: z.number().int(),
  type: z.enum(["movie", "tv", "short", "other"]).default("other"),
  role_in_production: z.string().trim().min(1, "El rol desempeñado es obligatorio"),
  countries: z
    .array(z.string())
    .optional()
    .transform((countries) => countries?.map((country) => country.trim()).filter(Boolean) ?? []),
  genre: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => value || null),
  external_url: optionalHttpUrlSchema,
  poster_url: optionalHttpUrlSchema,
  sort_order: z.number().int().min(0).default(0),
});

export type FilmographyInput = z.infer<typeof filmographyInputSchema>;

type HiringProfileRow = {
  social_links: unknown;
  travel_scope: string | null;
  has_own_vehicle: boolean | null;
  has_cargo_vehicle: boolean | null;
  can_drive_van: boolean | null;
};

export type HiringFormFields = Record<SocialNetwork, string> & {
  travel_scope: string;
  has_own_vehicle: boolean;
  has_cargo_vehicle: boolean;
  can_drive_van: boolean;
};

export function rowToHiringFormFields(row: HiringProfileRow): HiringFormFields {
  const socialLinks =
    row.social_links && typeof row.social_links === "object" && !Array.isArray(row.social_links)
      ? (row.social_links as Record<string, unknown>)
      : {};

  return {
    instagram: typeof socialLinks.instagram === "string" ? socialLinks.instagram : "",
    tiktok: typeof socialLinks.tiktok === "string" ? socialLinks.tiktok : "",
    linkedin: typeof socialLinks.linkedin === "string" ? socialLinks.linkedin : "",
    facebook: typeof socialLinks.facebook === "string" ? socialLinks.facebook : "",
    x: typeof socialLinks.x === "string" ? socialLinks.x : "",
    vimeo: typeof socialLinks.vimeo === "string" ? socialLinks.vimeo : "",
    youtube: typeof socialLinks.youtube === "string" ? socialLinks.youtube : "",
    travel_scope: row.travel_scope ?? "",
    has_own_vehicle: !!row.has_own_vehicle,
    has_cargo_vehicle: !!row.has_cargo_vehicle,
    can_drive_van: !!row.can_drive_van,
  };
}
