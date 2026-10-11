import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { collectExternalOrigins } from './lib/aulos-production-readiness.mjs';

const HOST = 'staging8.aulos.es';
const ROUTES = ['/', '/catalogo/', '/zine/', '/producto/leer-la-luna-tarot-y-cine-carlos-a-cuellar-alejandro/', '/carrito/', '/mi-cuenta/'];

function env(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const value = line.trim(); const index = value.indexOf('=');
    if (!value || value.startsWith('#') || index < 1) return [];
    return [[value.slice(0, index).trim(), value.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')]];
  }));
}

async function main() {
  const config = { ...env(await readFile('.env.aulos.local', 'utf8')), ...process.env };
  const base = new URL(config.AULOS_STAGING_URL);
  if (base.protocol !== 'https:' || base.hostname !== HOST) throw new Error(`Solo se permite consultar ${HOST}.`);
  const authorization = `Basic ${Buffer.from(`${config.AULOS_BASIC_USER}:${config.AULOS_BASIC_PASSWORD}`).toString('base64')}`;
  const byRoute = {}; const all = new Set();
  for (const route of ROUTES) {
    const response = await fetch(new URL(route, base), { headers: { Authorization: authorization, 'Cache-Control': 'no-cache' } });
    if (!response.ok) throw new Error(`${route} respondió ${response.status}.`);
    const origins = collectExternalOrigins(await response.text(), base);
    byRoute[route] = origins; origins.forEach((origin) => all.add(origin));
  }
  console.log(JSON.stringify({ routes: byRoute, allOrigins: [...all].sort() }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main().catch((error) => { console.error(error?.message ?? String(error)); process.exitCode = 1; });
