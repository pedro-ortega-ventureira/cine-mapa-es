type MunicipalityLocation = {
  name: string;
  province: string;
  lat: number | null;
  lng: number | null;
};

/** Maps a selected municipality to the fields consumed by the public map. */
export function locationFromMunicipality(municipality: MunicipalityLocation) {
  const hasCoordinates = municipality.lat !== null && municipality.lng !== null;

  return {
    geo_lat: hasCoordinates ? municipality.lat : null,
    geo_lng: hasCoordinates ? municipality.lng : null,
    geo_accuracy: hasCoordinates ? ("exact" as const) : ("none" as const),
    geo_municipality_name: municipality.name,
    geo_province: municipality.province,
  };
}
