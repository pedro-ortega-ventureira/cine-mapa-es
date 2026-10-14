import { readFile } from 'node:fs/promises';

const HOST = 'staging8.aulos.es';
const PLUGIN = 'aulos-webmcp-discovery/aulos-webmcp-discovery';

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const value = line.trim();
    const index = value.indexOf('=');
    if (!value || value.startsWith('#') || index < 1) return [];
    return [[value.slice(0, index).trim(), value.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')]];
  }));
}

function safeUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== HOST) throw new Error(`Solo se permite modificar ${HOST}.`);
  return url;
}

class Session {
  constructor(config) {
    this.config = config;
    this.cookies = new Map();
    this.restNonce = '';
    this.basic = `Basic ${Buffer.from(`${config.AULOS_BASIC_USER}:${config.AULOS_BASIC_PASSWORD}`).toString('base64')}`;
  }

  collect(response) {
    for (const cookie of response.headers.getSetCookie?.() ?? []) {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      if (index > 0) this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
  }

  async request(target, options = {}) {
    const url = safeUrl(target);
    const headers = new Headers(options.headers ?? {});
    headers.set('Authorization', this.basic);
    headers.set('User-Agent', 'Codex Aulos WebMCP Publisher');
    if (this.cookies.size) headers.set('Cookie', [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '));
    if (this.restNonce && url.pathname.startsWith('/wp-json/')) headers.set('X-WP-Nonce', this.restNonce);
    const response = await fetch(url, { ...options, headers, redirect: options.redirect ?? 'manual' });
    this.collect(response);
    return response;
  }

  async publicRequest(target, options = {}) {
    const url = safeUrl(target);
    const headers = new Headers(options.headers ?? {});
    headers.set('Authorization', this.basic);
    headers.set('User-Agent', 'Codex Aulos WebMCP Public Verifier');
    return fetch(url, { ...options, headers, redirect: options.redirect ?? 'manual' });
  }

  async login() {
    const base = safeUrl(this.config.AULOS_STAGING_URL).origin;
    await this.request(`${base}/wp-login.php`);
    const body = new URLSearchParams({
      log: this.config.AULOS_WP_USER,
      pwd: this.config.AULOS_WP_PASSWORD,
      'wp-submit': 'Acceder',
      redirect_to: `${base}/wp-admin/plugin-install.php?tab=upload`,
      testcookie: '1',
    });
    await this.request(`${base}/wp-login.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${base}/wp-login.php` },
      body,
    });
    const response = await this.request(`${base}/wp-admin/plugin-install.php?tab=upload`);
    const html = await response.text();
    const nonce = html.match(/wp\.apiFetch\.createNonceMiddleware\(\s*["']([^"']+)/);
    if (!response.ok || !nonce) throw new Error(`No se pudo abrir el administrador (${response.status}).`);
    this.restNonce = nonce[1];
  }

  async state() {
    const base = safeUrl(this.config.AULOS_STAGING_URL).origin;
    const response = await this.request(`${base}/wp-json/wp/v2/plugins/${PLUGIN}?context=edit`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`No se pudo consultar el plugin (${response.status}).`);
    return response.json();
  }

  async upload(zipPath) {
    const base = safeUrl(this.config.AULOS_STAGING_URL).origin;
    const page = await this.request(`${base}/wp-admin/plugin-install.php?tab=upload`);
    const html = await page.text();
    const nonce = html.match(/name=["']_wpnonce["']\s+value=["']([^"']+)/);
    if (!nonce) throw new Error('No se encontró el nonce de subida.');
    const form = new FormData();
    form.set('_wpnonce', nonce[1]);
    form.set('_wp_http_referer', '/wp-admin/plugin-install.php?tab=upload');
    form.set('pluginzip', new Blob([await readFile(zipPath)], { type: 'application/zip' }), 'aulos-webmcp-discovery.zip');
    form.set('install-plugin-submit', 'Instalar ahora');
    const response = await this.request(`${base}/wp-admin/update.php?action=upload-plugin`, { method: 'POST', body: form, redirect: 'follow' });
    await response.text();
    if (!response.ok || !(await this.state())) throw new Error(`WordPress rechazó la instalación (${response.status}).`);
  }

  async activate() {
    const base = safeUrl(this.config.AULOS_STAGING_URL).origin;
    const response = await this.request(`${base}/wp-json/wp/v2/plugins/${PLUGIN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    if (!response.ok) throw new Error(`No se pudo activar el plugin (${response.status}).`);
  }

  async remove(plugin) {
    const base = safeUrl(this.config.AULOS_STAGING_URL).origin;
    if (plugin.status === 'active') {
      const deactivate = await this.request(`${base}/wp-json/wp/v2/plugins/${PLUGIN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inactive' }),
      });
      if (!deactivate.ok) throw new Error(`No se pudo desactivar el plugin (${deactivate.status}).`);
    }
    const response = await this.request(`${base}/wp-json/wp/v2/plugins/${PLUGIN}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`No se pudo retirar el plugin anterior (${response.status}).`);
  }

  async verify() {
    const base = safeUrl(this.config.AULOS_STAGING_URL).origin;
    const checks = [
      ['content', 'tema=cine&maximo_resultados=3'],
      ['editions', 'consulta=arte&maximo_resultados=3'],
      ['reading-route', 'pregunta=cine&interes=ocultura&maximo_resultados=6'],
      ['reading-route', 'pregunta=&interes=&maximo_resultados=999'],
    ];
    const endpoints = [];
    for (const [route, query] of checks) {
      const response = await this.publicRequest(`${base}/wp-json/aulos-webmcp/v1/${route}?${query}`, { headers: { 'Cache-Control': 'no-cache' } });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.resultados)) throw new Error(`La ruta ${route} no respondió con el contrato esperado.`);
      endpoints.push({ route, status: response.status, results: payload.resultados.length, paid: payload.resultados.filter((item) => item.acceso === 'pago').length });
    }
    const pages = [];
    for (const route of ['/', '/zine/', '/catalogo/', '/producto/leer-la-luna-tarot-y-cine-carlos-a-cuellar-alejandro/', '/carrito/']) {
      const response = await this.request(`${base}${route}`, { headers: { 'Cache-Control': 'no-cache' }, redirect: 'follow' });
      const html = await response.text();
      pages.push({ route, status: response.status, asset: html.includes('aulos-webmcp-discovery') });
    }
    if (endpoints.some((item) => item.status !== 200 || (item.route === 'reading-route' && item.paid > 2))) {
      throw new Error(`La verificación de resultados WebMCP falló: ${JSON.stringify(endpoints)}.`);
    }
    if (pages.some((page) => page.status !== 200 || !page.asset)) {
      throw new Error(`El asset WebMCP no está presente en todas las páginas públicas: ${JSON.stringify(pages)}.`);
    }
    return { endpoints, pages };
  }
}

async function main() {
  const mode = process.argv[2];
  const zipPath = process.argv[3];
  if (!['--inspect', '--apply', '--replace', '--verify'].includes(mode)) throw new Error('Usa --inspect, --apply, --replace o --verify.');
  const config = { ...parseEnv(await readFile('.env.aulos.local', 'utf8')), ...process.env };
  for (const key of ['AULOS_STAGING_URL', 'AULOS_BASIC_USER', 'AULOS_BASIC_PASSWORD', 'AULOS_WP_USER', 'AULOS_WP_PASSWORD']) {
    if (!config[key]) throw new Error(`Falta ${key}.`);
  }
  const session = new Session(config);
  await session.login();
  const before = await session.state();
  if (mode === '--inspect') {
    console.log(JSON.stringify({ installed: Boolean(before), status: before?.status ?? 'absent', version: before?.version ?? '' }, null, 2));
    return;
  }
  if (mode === '--verify') {
    console.log(JSON.stringify(await session.verify(), null, 2));
    return;
  }
  if (mode === '--apply' && before) throw new Error('El plugin ya existe; se cancela para no sobrescribirlo.');
  if (mode === '--replace') {
    if (!before || before.plugin !== PLUGIN || before.version !== '0.1.1') {
      throw new Error('La versión instalada no coincide con la versión reemplazable.');
    }
    await session.remove(before);
  }
  if (!zipPath) throw new Error('Indica la ruta del ZIP.');
  await session.upload(zipPath);
  await session.activate();
  const after = await session.state();
  if (after.version !== '0.1.2') throw new Error('La versión instalada no coincide con el paquete nuevo.');
  const verification = await session.verify();
  console.log(JSON.stringify({ status: after.status, version: after.version, verification }, null, 2));
}

main().catch((error) => {
  console.error(error?.message ?? String(error));
  process.exitCode = 1;
});
