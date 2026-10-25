export const PUBLIC_ORIGIN = "https://mapa.xn--espaalatente-dhb.org";

export function canonicalUrl(pathname: string): string {
  const path = pathname === "/" ? "/" : `/${pathname.replace(/^\/+|\/+$/g, "")}`;
  return `${PUBLIC_ORIGIN}${path}`;
}
