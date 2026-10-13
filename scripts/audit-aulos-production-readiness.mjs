import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { auditPage, compareAuditRuns, renderAuditReport, summarizeAudit, validateCatalogContract } from './lib/aulos-production-audit.mjs';

const HOST = 'staging8.aulos.es';
export const AUDIT_ROUTES = [
  '/',
  '/catalogo/',
  '/shop/?s=arte&orderby=date',
  '/zine/',
  '/publica-con-aulos/',
  '/por-que-aulos/',
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
  async function runAudit(runId) {
    const pages = [];
    for (const [index, route] of AUDIT_ROUTES.entries()) {
    const target = new URL(route, base);
    target.searchParams.set('aulos_audit', `${runId}-${index}`);
    const response = await fetch(target, {
      headers: { Authorization: authorization, 'Cache-Control': 'no-cache', 'User-Agent': 'Codex Aulos Production Audit' },
      redirect: 'manual',
    });
    const html = response.headers.get('content-type')?.includes('text/html') ? await response.text() : '';
    pages.push({
      ...auditPage(html, response.headers, new URL(route, base), response.status),
      requestedUrl: target.toString(),
      redirect: response.headers.get('location') ?? '',
      cache: {
        age: response.headers.get('age') ?? '',
        cacheControl: response.headers.get('cache-control') ?? '',
        cacheStatus: response.headers.get('x-cache') ?? response.headers.get('cf-cache-status') ?? response.headers.get('x-proxy-cache-info') ?? '',
      },
    });
    }
    return pages;
  }
  const firstRunId = `${Date.now()}-a`;
  const secondRunId = `${Date.now()}-b`;
  const first = await runAudit(firstRunId);
  const second = await runAudit(secondRunId);
  const differences = compareAuditRuns(first, second);
  if (differences.length) throw new Error(`La auditoría no es estable entre ejecuciones: ${differences.join('; ')}`);
  const shop = second.find((page) => new URL(page.url).pathname === '/shop/');
  const catalog = second.find((page) => new URL(page.url).pathname === '/catalogo/');
  validateCatalogContract({ shop: { ...shop, url: shop.requestedUrl }, catalog });
  const pages = second;
  const cspMode = pages.every((page) => page.status >= 300 || page.security.cspMode === 'enforce') ? 'obligatoria (`enforce`)' : 'en observación (`Report-Only`)';
  const evidence = `\n## Evidencia reproducible\n\n- Dos ejecuciones independientes y estables: \`${firstRunId}\` y \`${secondRunId}\`.\n- Todas las rutas usaron un parámetro de cache-busting único y \`Cache-Control: no-cache\`.\n- Contrato verificado: \`/shop/\` responde 301 al mismo origen, destino exacto \`/catalogo/\`, conserva la query; el catálogo responde 200 y es autocanónico.\n- La CSP usa una lista explícita de orígenes y está ${cspMode}.\n`;
  const report = `${renderAuditReport(pages).trimEnd()}\n${evidence}`;
  await writeFile('docs/auditoria-preproduccion-aulos.md', report, { mode: 0o644 });
  const summary = summarizeAudit(pages);
  console.log(JSON.stringify({
    pages: pages.length,
    statuses: Object.fromEntries(pages.map((page) => [new URL(page.url).pathname, page.status])),
    ...summary,
    runIds: [firstRunId, secondRunId],
    stable: true,
    output: 'docs/auditoria-preproduccion-aulos.md',
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error?.message ?? String(error));
    process.exitCode = 1;
  });
}
