import test from 'node:test';
import assert from 'node:assert/strict';

import { collectExternalOrigins, redirectShopUrl, securityHeaders } from '../../../scripts/lib/aulos-production-readiness.mjs';

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

test('inventaría solo orígenes externos usados por recursos o formularios', () => {
  const html = `<link href="https://fonts.googleapis.com/css2"><script src="https://js.stripe.com/v3/"></script>
    <img src="/local.jpg"><form action="https://www.paypal.com/checkout"></form><a href="https://example.org/article">Artículo</a>`;

  assert.deepEqual(collectExternalOrigins(html, 'https://staging8.aulos.es/'), [
    'https://fonts.googleapis.com',
    'https://js.stripe.com',
    'https://www.paypal.com',
  ]);
});
