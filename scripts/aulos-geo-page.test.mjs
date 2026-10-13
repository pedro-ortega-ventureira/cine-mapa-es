import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REQUIRED_PRODUCT_TITLES,
  renderAulosGeoPage,
  selectRequiredProducts,
} from './lib/aulos-geo-page.mjs';

const products = [
  {
    name: ' La   vanguardia prerrafaelista ',
    permalink: 'https://staging8.aulos.es/producto/la-vanguardia-prerrafaelista/',
    status: 'publish',
  },
  {
    name: 'Leer la Luna. Tarot y cine',
    permalink: 'https://staging8.aulos.es/producto/leer-la-luna-tarot-y-cine-carlos-a-cuellar-alejandro/',
    status: 'publish',
  },
  {
    name: 'Patrimonio Digital',
    permalink: 'https://staging8.aulos.es/producto/patrimonio-digital/',
    status: 'publish',
  },
  {
    name: 'La conquista de Portugal. Historia e iconografía',
    permalink: 'https://staging8.aulos.es/producto/la-conquista-de-portugal/',
    status: 'publish',
  },
];

test('selectRequiredProducts preserves the approved title order despite whitespace', () => {
  assert.deepEqual(REQUIRED_PRODUCT_TITLES, [
    'La vanguardia prerrafaelista',
    'Leer la Luna. Tarot y cine',
    'Patrimonio Digital',
    'La conquista de Portugal. Historia e iconografía',
  ]);
  assert.deepEqual(
    selectRequiredProducts([...products].reverse()).map((product) => product.name),
    REQUIRED_PRODUCT_TITLES,
  );
});

test('selectRequiredProducts rejects a missing fourth approved title', () => {
  assert.throws(
    () => selectRequiredProducts(products.slice(0, -1)),
    /La conquista de Portugal\. Historia e iconografía/,
  );
});

test('renderAulosGeoPage renders the approved content with internal product routes', () => {
  const selected = selectRequiredProducts(products);
  const html = renderAulosGeoPage(selected);

  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /<h1[^>]*>Libros que piden otra forma de leer<\/h1>/);
  assert.match(html, />Criterio editorial</);
  assert.match(html, /<h2[^>]*>Cómo elegir un libro Aulós<\/h2>/);
  assert.match(html, /<h2[^>]*>Cuatro puertas de entrada<\/h2>/);
  assert.match(html, /href="\/catalogo\/"/);
  assert.doesNotMatch(html, /utm_/i);
  assert.doesNotMatch(html, /NOMBRE_COMPETIDOR/);
  assert.match(html, /#F5F2EC/i);
  assert.match(html, /#6D1F2C/i);
  assert.match(html, /font-family:[^;]*Georgia/i);
  for (const product of selected) {
    assert.ok(html.includes(product.permalink));
  }
});
