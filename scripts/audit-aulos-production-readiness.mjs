import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { auditPage, renderAuditReport } from './lib/aulos-production-audit.mjs';

const HOST = 'staging8.aulos.es';
const ROUTES = [
  '/',
  '/catalogo/',
  '/shop/',
  '/zine/',
  '/publica-con-aulos/',
  '/producto/leer-la-luna-tarot-y-cine-carlos-a-cuellar-alejandro/',
  '/carrito/',
  '/mi-cuenta/',
  '/terminos-y-condiciones/',
  '/politica-de-privacidad/',
  '/politica-de-cookies-ue/',
  '/reembolso_devoluciones/',
];

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return [];
    const index = trimmed.indexOf('=');
    if (index < 1) return [];
    return [[trimmed.slice(0, index).trim(), trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')]];
  }));
}

function stagingBase(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || parsed.hostname !== HOST) throw new Error(`Solo se permite auditar ${HOST}.`);
  return parsed.origin;
}

async function main() {
  const config = { ...parseEnv(await readFile('.env.aulos.local', 'utf8')), ...process.env };
  for (const key of ['AULOS_STAGING_URL', 'AULOS_BASIC_USER', 'AULOS_BASIC_PASSWORD']) {
    if (!config[key]) throw new Error(`Falta ${key}.`);
  }
  const base = stagingBase(config.AULOS_STAGING_URL);
  const authorization = `Basic ${Buffer.from(`${config.AULOS_BASIC_USER}:${config.AULOS_BASIC_PASSWORD}`).toString('base64')}`;
  const pages = [];
  for (const route of ROUTES) {
    const target = new URL(route, base);
    target.searchParams.set('aulos_audit', Date.now().toString());
    const response = await fetch(target, {
      headers: { Authorization: authorization, 'Cache-Control': 'no-cache', 'User-Agent': 'Codex Aulos Production Audit' },
      redirect: 'manual',
    });
    const html = response.headers.get('content-type')?.includes('text/html') ? await response.text() : '';
    pages.push({
      ...auditPage(html, response.headers, new URL(route, base), response.status),
      redirect: response.headers.get('location') ?? '',
    });
  }
  const report = renderAuditReport(pages);
  await writeFile('docs/auditoria-preproduccion-aulos.md', report, { mode: 0o644 });
  console.log(JSON.stringify({
    pages: pages.length,
    statuses: Object.fromEntries(pages.map((page) => [new URL(page.url).pathname, page.status])),
    totalH1Issues: pages.filter((page) => page.mainH1Count !== 1).length,
    missingDescriptions: pages.filter((page) => !page.description).length,
    missingCanonicals: pages.filter((page) => !page.canonical).length,
    output: 'docs/auditoria-preproduccion-aulos.md',
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error?.message ?? String(error));
    process.exitCode = 1;
  });
}
