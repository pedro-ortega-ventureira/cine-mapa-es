import { SOCIAL_NETWORKS, type SocialNetwork } from "@/lib/hiring-profile";

type PublicHiringProfile = {
  availability: string | null;
  works_remotely: boolean | null;
  willing_to_travel: boolean | null;
  travel_scope: string | null;
  has_own_vehicle: boolean | null;
  has_cargo_vehicle: boolean | null;
  can_drive_van: boolean | null;
  social_links: unknown;
};

export type PublicHiringDetail = {
  key: string;
  label: string;
  value: string;
  href?: string;
};

const travelScopeLabels: Record<string, string> = {
  local: "Local",
  provincial: "Provincial",
  national: "Nacional",
  international: "Internacional",
};

const socialLabels: Record<SocialNetwork, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  x: "X",
  vimeo: "Vimeo",
  youtube: "YouTube",
};

function isPublicHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function publicHiringDetails(profile: PublicHiringProfile): PublicHiringDetail[] {
  const details: PublicHiringDetail[] = [];
  const addBoolean = (key: string, label: string, value: boolean | null) => {
    if (value !== null) details.push({ key, label, value: value ? "Sí" : "No" });
  };

  if (profile.availability) {
    details.push({ key: "availability", label: "Disponibilidad", value: profile.availability });
  }
  addBoolean("remote", "Trabajo en remoto", profile.works_remotely);
  addBoolean("willing", "Dispuesto/a a viajar", profile.willing_to_travel);
  if (profile.travel_scope && travelScopeLabels[profile.travel_scope]) {
    details.push({
      key: "travel",
      label: "Ámbito de desplazamiento",
      value: travelScopeLabels[profile.travel_scope],
    });
  }
  addBoolean("vehicle", "Vehículo propio", profile.has_own_vehicle);
  addBoolean("cargo", "Vehículo de carga", profile.has_cargo_vehicle);
  addBoolean("van", "Puede conducir furgoneta", profile.can_drive_van);

  const socialLinks =
    profile.social_links &&
    typeof profile.social_links === "object" &&
    !Array.isArray(profile.social_links)
      ? (profile.social_links as Record<string, unknown>)
      : {};
  for (const network of SOCIAL_NETWORKS) {
    const href = socialLinks[network];
    if (isPublicHttpUrl(href)) {
      details.push({
        key: `social-${network}`,
        label: socialLabels[network],
        value: "Ver perfil",
        href,
      });
    }
  }

  return details;
}
