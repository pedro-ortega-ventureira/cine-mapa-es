const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self' https://www.paypal.com https://*.stripe.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://stats.wp.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.gravatar.com https://*.wp.com https://stats.wp.com https://www.google-analytics.com https://www.googletagmanager.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.google-analytics.com https://*.stripe.com https://stats.wp.com https://www.googletagmanager.com",
  "frame-src 'self' https://*.stripe.com https://www.paypal.com https://mistericaland.substack.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
].join('; ');

const SEO = {
  '/': { title: 'Ediciones Aulós | Libros de arte y humanidades', description: 'Editorial independiente de arte, estética, cine y humanidades. Descubre libros académicos cuidados y publica tu investigación con Aulós.' },
  '/catalogo/': { title: 'Catálogo de libros | Ediciones Aulós', description: 'Descubre el catálogo de Ediciones Aulós: libros de arte, estética, cine, filosofía, ocultura y humanidades editados con rigor y cuidado.' },
  '/zine/': { title: 'Aulós Zine | Arte, cine y pensamiento', description: 'Revista académica de Ediciones Aulós sobre arte, cine, estética, historia, ocultura y humanidades digitales. ISSN 2952-4148.' },
  '/publica-con-aulos/': { title: 'Publica tu investigación | Ediciones Aulós', description: 'Convierte tu tesis, TFM, catálogo o proyecto de investigación en un libro cuidado, riguroso y con recorrido editorial junto a Ediciones Aulós.' },
  '/producto/leer-la-luna-tarot-y-cine-carlos-a-cuellar-alejandro/': { title: 'Leer la Luna: tarot y cine | Ediciones Aulós', description: 'Descubre Leer la Luna, de Carlos A. Cuéllar Alejandro: un ensayo sobre el simbolismo lunar, el tarot y su presencia en la historia del cine.' },
  '/terminos-y-condiciones/': { title: 'Términos y condiciones | Ediciones Aulós', description: 'Consulta las condiciones de acceso, uso y compra de libros y publicaciones en la tienda online de Ediciones Aulós.' },
  '/politica-de-privacidad/': { title: 'Política de privacidad | Ediciones Aulós', description: 'Conoce cómo Ediciones Aulós trata y protege los datos personales de quienes navegan, contactan o compran en su sitio web.' },
  '/politica-de-cookies-ue/': { title: 'Política de cookies | Ediciones Aulós', description: 'Información sobre las cookies utilizadas por Ediciones Aulós, sus finalidades y las opciones disponibles para gestionar el consentimiento.' },
  '/reembolso_devoluciones/': { title: 'Devoluciones y reembolsos | Ediciones Aulós', description: 'Consulta la política de desistimiento, devoluciones y reembolsos aplicable a libros impresos y publicaciones digitales de Ediciones Aulós.' },
  '/carrito/': { robots: 'noindex,follow' },
  '/mi-cuenta/': { robots: 'noindex,follow' },
};

export function seoMetadata(pathname) {
  const value = SEO[pathname];
  if (!value) return null;
  return { title: '', description: '', robots: 'index,follow', ...value };
}

export function redirectShopUrl(value) {
  const url = new URL(value);
  if (!['/shop', '/shop/'].includes(url.pathname)) return null;
  url.pathname = '/catalogo/';
  return url.toString();
}

export function securityHeaders({ cspMode = 'report-only' } = {}) {
  if (!['report-only', 'enforce'].includes(cspMode)) throw new Error('Modo CSP inválido.');
  return {
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
    'X-Frame-Options': 'SAMEORIGIN',
    [cspMode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only']: CSP,
  };
}

export function collectExternalOrigins(html, baseUrl) {
  const base = new URL(baseUrl);
  const origins = new Set();
  const tags = String(html).match(/<(?:link|script|img|form|iframe|video|audio|source)\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    for (const match of tag.matchAll(/(?:href|src|action)\s*=\s*(["'])(.*?)\1/gi)) {
      try {
        const target = new URL(match[2], base);
        if (target.origin !== base.origin && ['http:', 'https:'].includes(target.protocol)) origins.add(target.origin);
      } catch {}
    }
  }
  return [...origins].sort();
}

export function homeOverflowCss() {
  return 'body.home .content-wrapper > .main-row{margin-left:0!important;margin-right:0!important}';
}

export { CSP as AULOS_CSP };
