import test from 'node:test';
import assert from 'node:assert/strict';

import { readFile } from 'node:fs/promises';
import { AULOS_CSP, collectExternalOrigins, homeOverflowCss, redirectShopUrl, securityHeaders } from '../../../scripts/lib/aulos-production-readiness.mjs';

test('redirige solo la raíz exacta de shop y conserva la query', () => {
  assert.equal(redirectShopUrl('https://staging8.aulos.es/shop/'), 'https://staging8.aulos.es/catalogo/');
  assert.equal(redirectShopUrl('https://staging8.aulos.es/shop/?s=arte&orderby=date'), 'https://staging8.aulos.es/catalogo/?s=arte&orderby=date');
  assert.equal(redirectShopUrl('https://staging8.aulos.es/shop'), 'https://staging8.aulos.es/catalogo/');
});

test('no redirige productos, carrito, cuenta ni rutas hijas', () => {
  for (const path of ['/shop/arte/', '/producto/libro/', '/carrito/', '/mi-cuenta/', '/wp-admin/']) {
    assert.equal(redirectShopUrl(`https://staging8.aulos.es${path}`), null, path);
  }
});

test('genera las cuatro familias de cabeceras en report-only', () => {
  const headers = securityHeaders({ cspMode: 'report-only' });

  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.equal(headers['X-Frame-Options'], 'SAMEORIGIN');
  assert.match(headers['Permissions-Policy'], /camera=\(\).*microphone=\(\).*geolocation=\(\)/);
  assert.match(headers['Content-Security-Policy-Report-Only'], /default-src 'self'/);
  assert.match(headers['Content-Security-Policy-Report-Only'], /frame-ancestors 'self'/);
  assert.equal(headers['Content-Security-Policy'], undefined);
});

test('cambia exclusivamente el nombre de CSP al pasar a enforce', () => {
  const reportOnly = securityHeaders({ cspMode: 'report-only' });
  const enforce = securityHeaders({ cspMode: 'enforce' });
  const policy = reportOnly['Content-Security-Policy-Report-Only'];

  assert.equal(enforce['Content-Security-Policy'], policy);
  assert.equal(enforce['Content-Security-Policy-Report-Only'], undefined);
  assert.deepEqual(
    Object.fromEntries(Object.entries(enforce).filter(([name]) => name !== 'Content-Security-Policy')),
    Object.fromEntries(Object.entries(reportOnly).filter(([name]) => name !== 'Content-Security-Policy-Report-Only')),
  );
});

test('la CSP usa orígenes explícitos y no permite cualquier host HTTPS', () => {
  assert.doesNotMatch(AULOS_CSP, /(?:^|\s)https:(?:\s|;|$)/);
  for (const origin of ['https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'https://js.stripe.com', 'https://www.googletagmanager.com']) {
    assert.match(AULOS_CSP, new RegExp(origin.replaceAll('.', '\\.')));
  }
});

test('el PHP desplegable comparte la CSP, versión y modo seguro del contrato', async () => {
  const php = await readFile(new URL('../aulos-production-readiness.php', import.meta.url), 'utf8');
  const policy = php.match(/private const CSP = "([^"]+)";/)?.[1];
  assert.equal(policy, AULOS_CSP);
  assert.match(php, /Version:\s*1\.0\.3/);
  assert.match(php, /apply_filters\('aulos_csp_mode', 'report-only'\)/);
});

test('inventaría solo orígenes externos usados por recursos o formularios', () => {
  const html = `<link href="https://fonts.googleapis.com/css2"><script src="https://js.stripe.com/v3/"></script>
    <img src="/local.jpg"><form action="https://www.paypal.com/checkout"></form><a href="https://example.org/article">Artículo</a>`;

  assert.deepEqual(collectExternalOrigins(html, 'https://staging8.aulos.es/'), [
    'https://fonts.googleapis.com',
    'https://js.stripe.com',
    'https://www.paypal.com',
  ]);
});

test('limita la corrección de desbordamiento a la fila principal de la home', () => {
  const css = homeOverflowCss();
  assert.match(css, /^body\.home \.content-wrapper > \.main-row/);
  assert.match(css, /margin-left:\s*0!important/);
  assert.match(css, /margin-right:\s*0!important/);
  assert.doesNotMatch(css, /(^|,)\s*\.row\b/);
});
