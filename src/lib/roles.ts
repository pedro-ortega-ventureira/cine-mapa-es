// Paleta estable por profesión, compartida entre mapa y tarjetas.
export const ROLE_COLORS: Record<string, string> = {
  "Dirección": "#ef4444",
  "Guion": "#f97316",
  "Producción": "#eab308",
  "Dirección de fotografía": "#84cc16",
  "Cámara": "#22c55e",
  "Sonido": "#06b6d4",
  "Montaje": "#3b82f6",
  "Arte": "#8b5cf6",
  "Vestuario": "#ec4899",
  "Maquillaje": "#f43f5e",
  "Interpretación": "#14b8a6",
  "VFX": "#a855f7",
  "Postproducción": "#6366f1",
};

const ROLE_DEFAULT = "#64748b";

export function colorForRole(role: string | null | undefined): string {
  if (!role) return ROLE_DEFAULT;
  if (ROLE_COLORS[role]) return ROLE_COLORS[role];
  let h = 0;
  for (let i = 0; i < role.length; i++) h = (h * 31 + role.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360} 65% 50%)`;
}
