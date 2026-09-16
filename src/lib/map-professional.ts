export type MapProfessional = {
  id: string;
  slug: string;
  full_name: string;
  alias: string | null;
  photo_url: string | null;
  primary_role: string | null;
  verified: boolean;
  geo_lat: number;
  geo_lng: number;
  geo_accuracy: "exact" | "province";
  geo_municipality_name: string | null;
  geo_province: string | null;
};