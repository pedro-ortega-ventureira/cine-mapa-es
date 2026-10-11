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
