import { z } from "zod";
import { TRAVEL_SCOPES } from "@/lib/hiring-profile";

const urlBooleanSchema = z.enum(["true", "false"]).optional().catch(undefined);

export const directorySearchSchema = z.object({
  q: z.string().optional(),
  ccaa: z.string().optional(),
  provincia: z.string().optional(),
  rol: z.string().optional(),
  tipo: z.string().optional(),
  availability: z
    .enum(["Disponible", "No disponible", "Bajo consulta"])
    .optional()
    .catch(undefined),
  remote: urlBooleanSchema,
  willing: urlBooleanSchema,
  travel: z.enum(TRAVEL_SCOPES).optional().catch(undefined),
  vehicle: urlBooleanSchema,
  cargo: urlBooleanSchema,
  van: urlBooleanSchema,
});

export type DirectorySearch = z.infer<typeof directorySearchSchema>;

type ExactFilterQuery<Query> = {
  eq(column: string, value: unknown): Query;
};

export function applyHiringFilters<Query extends ExactFilterQuery<Query>>(
  initialQuery: Query,
  search: DirectorySearch,
): Query {
  let query = initialQuery;
  if (search.availability !== undefined) query = query.eq("availability", search.availability);
  if (search.remote !== undefined) query = query.eq("works_remotely", search.remote === "true");
  if (search.willing !== undefined)
    query = query.eq("willing_to_travel", search.willing === "true");
  if (search.travel !== undefined) query = query.eq("travel_scope", search.travel);
  if (search.vehicle !== undefined) query = query.eq("has_own_vehicle", search.vehicle === "true");
  if (search.cargo !== undefined) query = query.eq("has_cargo_vehicle", search.cargo === "true");
  if (search.van !== undefined) query = query.eq("can_drive_van", search.van === "true");
  return query;
}
