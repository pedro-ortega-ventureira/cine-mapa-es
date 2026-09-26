export const TRAVEL_SCOPES = ["local", "provincial", "national", "international"] as const;

export type TravelScope = (typeof TRAVEL_SCOPES)[number];
