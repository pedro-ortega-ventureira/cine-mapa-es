import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const HOST = 'staging8.aulos.es';
const PLUGIN = 'aulos-production-readiness/aulos-production-readiness';

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const value = line.trim(); const index = value.indexOf('=');
    if (!value || value.startsWith('#') || index < 1) return [];
    return [[value.slice(0, index).trim(), value.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')]];
  }));
}

function stagingUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || parsed.hostname !== HOST) throw new Error(`Solo se permite modificar ${HOST}.`);
  return parsed;
}

class Session {
  constructor(config) {
    this.config = config; this.cookies = new Map(); this.restNonce = '';
    this.basic = `Basic ${Buffer.from(`${config.AULOS_BASIC_USER}:${config.AULOS_BASIC_PASSWORD}`).toString('base64')}`;
  }
  collect(response) {
    for (const cookie of response.headers.getSetCookie?.() ?? []) {
      const [pair] = cookie.split(';'); const index = pair.indexOf('=');
      if (index > 0) this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
  }
  async request(target, options = {}) {
    const parsed = stagingUrl(target); const headers = new Headers(options.headers ?? {});
    headers.set('Authorization', this.basic); headers.set('User-Agent', 'Codex Aulos Readiness Publisher');
    if (this.cookies.size) headers.set('Cookie', [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '));
    if (this.restNonce && parsed.pathname.startsWith('/wp-json/')) headers.set('X-WP-Nonce', this.restNonce);
    const response = await fetch(parsed, { ...options, headers, redirect: options.redirect ?? 'manual' }); this.collect(response); return response;
  }
  async login() {
    const base = stagingUrl(this.config.AULOS_STAGING_URL).origin;
    await this.request(`${base}/wp-login.php`);
    const body = new URLSearchParams({ log: this.config.AULOS_WP_USER, pwd: this.config.AULOS_WP_PASSWORD, 'wp-submit': 'Acceder', redirect_to: `${base}/wp-admin/plugin-install.php?tab=upload`, testcookie: '1' });
    await this.request(`${base}/wp-login.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${base}/wp-login.php` }, body });
    const response = await this.request(`${base}/wp-admin/plugin-install.php?tab=upload`); const html = await response.text();
    const nonce = html.match(/wp\.apiFetch\.createNonceMiddleware\(\s*["']([^"']+)/);
    if (!response.ok || !nonce) throw new Error(`No se pudo abrir el administrador (${response.status}).`);
    this.restNonce = nonce[1];
  }
  async state() {
    const base = stagingUrl(this.config.AULOS_STAGING_URL).origin;
    const response = await this.request(`${base}/wp-json/wp/v2/plugins/${PLUGIN}?context=edit`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`No se pudo consultar el plugin (${response.status}).`);
    return response.json();
  }
  async upload(zipPath) {
    const base = stagingUrl(this.config.AULOS_STAGING_URL).origin;
    const page = await this.request(`${base}/wp-admin/plugin-install.php?tab=upload`); const html = await page.text();
    const nonce = html.match(/name=["']_wpnonce["']\s+value=["']([^"']+)/);
    if (!nonce) throw new Error('No se encontró el nonce de subida.');
    const form = new FormData(); form.set('_wpnonce', nonce[1]); form.set('_wp_http_referer', '/wp-admin/plugin-install.php?tab=upload');
    form.set('pluginzip', new Blob([await readFile(zipPath)], { type: 'application/zip' }), 'aulos-production-readiness.zip'); form.set('install-plugin-submit', 'Instalar ahora');
    const response = await this.request(`${base}/wp-admin/update.php?action=upload-plugin`, { method: 'POST', body: form, redirect: 'follow' });
    await response.text();
    if (!response.ok || !(await this.state())) throw new Error(`WordPress rechazó la instalación (${response.status}).`);
  }
  async setStatus(status) {
    const base = stagingUrl(this.config.AULOS_STAGING_URL).origin;
    const response = await this.request(`${base}/wp-json/wp/v2/plugins/${PLUGIN}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (!response.ok) throw new Error(`No se pudo cambiar el estado del plugin (${response.status}).`);
  }
  async remove() {
    const base = stagingUrl(this.config.AULOS_STAGING_URL).origin; const current = await this.state();
    if (current?.status === 'active') await this.setStatus('inactive');
    const response = await this.request(`${base}/wp-json/wp/v2/plugins/${PLUGIN}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`No se pudo retirar el plugin (${response.status}).`);
  }
  async verify() {
    const base = stagingUrl(this.config.AULOS_STAGING_URL).origin;
    const shop = await this.request(`${base}/shop/?s=arte`, { headers: { 'Cache-Control': 'no-cache' } });
    const home = await this.request(`${base}/?security_verify=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
    const exclusions = {};
    for (const route of ['/producto/leer-la-luna-tarot-y-cine-carlos-a-cuellar-alejandro/', '/carrito/', '/mi-cuenta/']) {
      exclusions[route] = (await this.request(`${base}${route}`, { headers: { 'Cache-Control': 'no-cache' } })).status;
    }
    return {
      shopStatus: shop.status,
      shopLocation: shop.headers.get('location') ?? '',
      exclusions,
      headers: {
        referrerPolicy: home.headers.get('referrer-policy') ?? '', permissionsPolicy: home.headers.get('permissions-policy') ?? '',
        frameProtection: home.headers.get('x-frame-options') ?? '', csp: home.headers.get('content-security-policy') ?? '',
        cspReportOnly: home.headers.get('content-security-policy-report-only') ?? '',
      },
    };
  }
}

function assertVerification(result, expectedCspMode) {
  if (result.shopStatus !== 301 || !result.shopLocation.includes('/catalogo/?s=arte')) throw new Error('La redirección de /shop/ no coincide con el contrato.');
  if (Object.values(result.exclusions).some((status) => status !== 200)) throw new Error('La redirección afecta a una ruta excluida.');
  if (!result.headers.referrerPolicy || !result.headers.permissionsPolicy || !result.headers.frameProtection) throw new Error('Faltan cabeceras de seguridad.');
  if (expectedCspMode === 'report-only' ? !result.headers.cspReportOnly : !result.headers.csp) throw new Error('La CSP no está en el modo esperado.');
}

async function main() {
  const mode = process.argv[2]; const zipPath = process.argv[3];
  if (!['--inspect', '--apply', '--replace', '--verify'].includes(mode)) throw new Error('Usa --inspect, --apply, --replace o --verify.');
  const config = { ...parseEnv(await readFile('.env.aulos.local', 'utf8')), ...process.env };
  for (const key of ['AULOS_STAGING_URL', 'AULOS_BASIC_USER', 'AULOS_BASIC_PASSWORD', 'AULOS_WP_USER', 'AULOS_WP_PASSWORD']) if (!config[key]) throw new Error(`Falta ${key}.`);
  const client = new Session(config); await client.login(); const before = await client.state();
  if (mode === '--inspect') { console.log(JSON.stringify({ installed: Boolean(before), status: before?.status ?? 'absent', version: before?.version ?? '' }, null, 2)); return; }
  if (mode === '--verify') { const result = await client.verify(); console.log(JSON.stringify(result, null, 2)); return; }
  if (!zipPath) throw new Error('Indica la ruta del ZIP.');
  if (mode === '--apply') {
    if (before) throw new Error('El plugin ya existe; se cancela para no sobrescribirlo.');
  } else {
    if (!before || before.plugin !== PLUGIN || before.version !== '1.0.1') throw new Error('La versión remota no se puede reemplazar de forma segura.');
    await client.remove();
  }
  await client.upload(zipPath); await client.setStatus('active');
  const after = await client.state(); const verification = await client.verify(); const expectedMode = after.version === '1.0.0' ? 'report-only' : 'enforce';
  if (mode === '--replace' && after.version !== '1.0.2') throw new Error('La versión instalada no coincide con 1.0.2.');
  assertVerification(verification, expectedMode);
  console.log(JSON.stringify({ status: after.status, version: after.version, expectedMode, verification }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main().catch((error) => { console.error(error?.message ?? String(error)); process.exitCode = 1; });
