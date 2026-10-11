import test from 'node:test';
import assert from 'node:assert/strict';

import { auditPage, renderAuditReport, summarizeAudit } from './lib/aulos-production-audit.mjs';

test('extrae metadatos, canonical y jerarquía del contenido principal', () => {
  const html = `<!doctype html><html><head>
    <title>Catálogo editorial | Aulós</title>
    <meta name="description" content="Libros de arte, pensamiento y humanidades.">
    <link rel="canonical" href="https://staging8.aulos.es/catalogo/">
  </head><body><header><h1>Aulós</h1></header><main><h1>Catálogo</h1><h2>Novedades</h2><h3>Arte</h3></main></body></html>`;
  const headers = new Headers({
    'content-security-policy-report-only': "default-src 'self'",
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=()',
    'x-frame-options': 'SAMEORIGIN',
  });

  const audit = auditPage(html, headers, 'https://staging8.aulos.es/catalogo/', 200);

  assert.equal(audit.status, 200);
  assert.equal(audit.title, 'Catálogo editorial | Aulós');
  assert.equal(audit.description, 'Libros de arte, pensamiento y humanidades.');
  assert.equal(audit.canonical, 'https://staging8.aulos.es/catalogo/');
  assert.deepEqual(audit.headings.map(({ level, text, inMain }) => ({ level, text, inMain })), [
    { level: 1, text: 'Aulós', inMain: false },
    { level: 1, text: 'Catálogo', inMain: true },
    { level: 2, text: 'Novedades', inMain: true },
    { level: 3, text: 'Arte', inMain: true },
  ]);
  assert.equal(audit.h1Count, 2);
  assert.equal(audit.mainH1Count, 1);
  assert.deepEqual(audit.security, {
    contentSecurityPolicy: "default-src 'self'",
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'camera=()',
    frameProtection: 'SAMEORIGIN',
  });
});

test('tolera atributos reordenados, entidades y metadatos ausentes', () => {
  const html = '<html><head><meta content="Una editorial &amp; revista" name="description"></head><body><main><h1><span>Aulós &amp; cultura</span></h1></main></body></html>';
  const audit = auditPage(html, new Headers(), 'https://staging8.aulos.es/', 200);

  assert.equal(audit.title, '');
  assert.equal(audit.description, 'Una editorial & revista');
  assert.equal(audit.canonical, '');
  assert.equal(audit.headings[0].text, 'Aulós & cultura');
  assert.equal(audit.mainH1Count, 1);
});

test('el informe clasifica bloqueantes sin incluir secretos ni userinfo', () => {
  const pages = [{
    url: 'https://staging8.aulos.es/shop/', status: 200, title: '', description: '', canonical: 'https://staging8.aulos.es/shop/',
    headings: [], h1Count: 0, mainH1Count: 0,
    security: { contentSecurityPolicy: '', referrerPolicy: '', permissionsPolicy: '', frameProtection: '' },
  }];

  const report = renderAuditReport(pages, { generatedAt: '2026-10-11T00:00:00.000Z' });

  assert.match(report, /## Bloqueantes/);
  assert.match(report, /sin H1 de contenido/);
  assert.match(report, /metadescripción/);
  assert.doesNotMatch(report, /usuario:secreto@|Authorization|Cookie/i);
});

test('el informe resume textos extensos para seguir siendo revisable', () => {
  const longDescription = 'a'.repeat(240);
  const pages = [{
    url: 'https://staging8.aulos.es/', status: 200, title: 'Inicio', description: longDescription,
    canonical: 'https://staging8.aulos.es/', headings: [{ level: 1, text: 'Inicio', inMain: true }],
    h1Count: 1, mainH1Count: 1,
    security: { contentSecurityPolicy: 'ok', referrerPolicy: 'ok', permissionsPolicy: 'ok', frameProtection: 'ok' },
  }];

  const report = renderAuditReport(pages);

  assert.doesNotMatch(report, new RegExp(longDescription));
  assert.match(report, /a{80,}…/);
});

test('trata una redirección esperada como ruta técnica sin exigir metadatos', () => {
  const pages = [{
    url: 'https://staging8.aulos.es/shop/', status: 301, redirect: 'https://staging8.aulos.es/catalogo/',
    title: '', description: '', canonical: '', headings: [], h1Count: 0, mainH1Count: 0,
    security: { contentSecurityPolicy: 'ok', referrerPolicy: 'ok', permissionsPolicy: 'ok', frameProtection: 'ok' },
  }];

  const report = renderAuditReport(pages);

  assert.match(report, /`\/shop\/` → `\/catalogo\/` \(HTTP 301\)/);
  assert.doesNotMatch(report, /sin H1|sin título|sin metadescripción|sin canonical/);
});

test('el resumen excluye redirecciones de los requisitos editoriales', () => {
  const pages = [
    { status: 301, redirect: 'https://staging8.aulos.es/catalogo/', mainH1Count: 0, description: '', canonical: '' },
    { status: 200, redirect: '', mainH1Count: 1, description: '', canonical: 'https://staging8.aulos.es/mi-cuenta/' },
  ];

  assert.deepEqual(summarizeAudit(pages), { totalH1Issues: 0, missingDescriptions: 1, missingCanonicals: 0 });
});

test('ignora etiquetas de encabezado incluidas dentro de scripts y estilos', () => {
  const html = '<main><h1>Revista</h1><script>const card = "<h2>\'+post.title+\'</h2>";</script><style>.x:after{content:"<h3>Fake</h3>"}</style><h2>Artículos</h2></main>';
  const audit = auditPage(html, new Headers(), 'https://staging8.aulos.es/zine/');
  assert.deepEqual(audit.headings.map(({ level, text }) => ({ level, text })), [
    { level: 1, text: 'Revista' },
    { level: 2, text: 'Artículos' },
  ]);
});

test('señala metadescripciones que exceden la longitud recomendada', () => {
  const pages = [{
    url: 'https://staging8.aulos.es/', status: 200, redirect: '', title: 'Inicio', description: 'a'.repeat(181),
    canonical: 'https://staging8.aulos.es/', headings: [{ level: 1, text: 'Inicio', inMain: true }], h1Count: 1, mainH1Count: 1,
    security: { contentSecurityPolicy: 'ok', referrerPolicy: 'ok', permissionsPolicy: 'ok', frameProtection: 'ok' },
  }];
  assert.match(renderAuditReport(pages), /metadescripción demasiado larga \(181 caracteres\)/);
});
