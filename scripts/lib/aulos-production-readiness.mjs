const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self' https://www.paypal.com https://*.stripe.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https:",
  "frame-src 'self' https:",
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
].join('; ');

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

export { CSP as AULOS_CSP };
