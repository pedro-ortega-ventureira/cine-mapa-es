export const MAX_FEATURED_PRODUCTIONS = 5;

export type FilmographyMutation =
  | { kind: "insert"; existingCount: number }
  | { kind: "update" | "delete"; profileId: string; itemProfessionalId: string }
  | { kind: "reorder"; requestedIds: string[]; ownedIds: string[] };

export type FilmographyMutationResult =
  { ok: true } | { ok: false; reason: "limit_reached" | "not_owned" | "incomplete_set" };

export function ownsFilmographyItem(profileId: string, itemProfessionalId: string): boolean {
  return profileId === itemProfessionalId;
}

export function validateFilmographyMutation(
  mutation: FilmographyMutation,
): FilmographyMutationResult {
  if (mutation.kind === "insert") {
    return mutation.existingCount >= MAX_FEATURED_PRODUCTIONS
      ? { ok: false, reason: "limit_reached" }
      : { ok: true };
  }

  if (mutation.kind === "reorder") {
    const ownedIds = new Set(mutation.ownedIds);
    if (!mutation.requestedIds.every((id) => ownedIds.has(id))) {
      return { ok: false, reason: "not_owned" };
    }
    return mutation.requestedIds.length === ownedIds.size
      ? { ok: true }
      : { ok: false, reason: "incomplete_set" };
  }

  return ownsFilmographyItem(mutation.profileId, mutation.itemProfessionalId)
    ? { ok: true }
    : { ok: false, reason: "not_owned" };
}
