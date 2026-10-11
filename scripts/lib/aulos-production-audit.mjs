function decodeEntities(value) {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return String(value ?? '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function plainText(value) {
  return decodeEntities(String(value ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function attributes(tag) {
  return Object.fromEntries([...String(tag).matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gs)]
    .map((match) => [match[1].toLowerCase(), decodeEntities(match[3])]));
}

function metaContent(html, name) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if ((attrs.name ?? '').toLowerCase() === name) return attrs.content ?? '';
  }
  return '';
}

function canonicalHref(html) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if ((attrs.rel ?? '').toLowerCase().split(/\s+/).includes('canonical')) return attrs.href ?? '';
  }
  return '';
}

function mainRanges(html) {
  const ranges = [];
  for (const match of html.matchAll(/<main\b[^>]*>[\s\S]*?<\/main>/gi)) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

function header(headers, name) {
  return headers?.get?.(name) ?? '';
}

export function auditPage(html, headers, url, status = 200) {
  const source = String(html ?? '');
  const semanticSource = source.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi, (block) => ' '.repeat(block.length));
  const ranges = mainRanges(semanticSource);
  const headings = [...semanticSource.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((match) => ({
    level: Number(match[1]),
    text: plainText(match[2]),
    inMain: ranges.some(([start, end]) => match.index >= start && match.index < end),
  }));
  const titleMatch = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const contentSecurityPolicy = header(headers, 'content-security-policy')
    || header(headers, 'content-security-policy-report-only');
  return {
    url: new URL(url).toString(),
    status,
    title: plainText(titleMatch?.[1] ?? ''),
    description: metaContent(source, 'description'),
    canonical: canonicalHref(source),
    headings,
    h1Count: headings.filter(({ level }) => level === 1).length,
    mainH1Count: headings.filter(({ level, inMain }) => level === 1 && inMain).length,
    security: {
      contentSecurityPolicy,
      referrerPolicy: header(headers, 'referrer-policy'),
      permissionsPolicy: header(headers, 'permissions-policy'),
      frameProtection: header(headers, 'x-frame-options') || (/frame-ancestors/i.test(contentSecurityPolicy) ? 'CSP frame-ancestors' : ''),
    },
  };
}

function escapeCell(value) {
  const normalized = String(value ?? '').replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
  if (!normalized) return '—';
  return normalized.length > 180 ? `${normalized.slice(0, 179).trimEnd()}…` : normalized;
}

export function renderAuditReport(pages, { generatedAt = new Date().toISOString() } = {}) {
  const blockers = [];
  const recommendations = [];
  const redirects = [];
  for (const page of pages) {
    const path = new URL(page.url).pathname;
    const isRedirect = page.status >= 300 && page.status < 400;
    if (isRedirect && page.redirect) {
      redirects.push(`- \`${path}\` → \`${new URL(page.redirect, page.url).pathname}\` (HTTP ${page.status}).`);
      continue;
    }
    if (page.status >= 400) blockers.push(`- \`${path}\`: responde HTTP ${page.status}.`);
    if (page.mainH1Count === 0) blockers.push(`- \`${path}\`: sin H1 de contenido.`);
    if (page.mainH1Count > 1) blockers.push(`- \`${path}\`: ${page.mainH1Count} H1 dentro del contenido principal.`);
    if (page.h1Count > page.mainH1Count) recommendations.push(`- \`${path}\`: ${page.h1Count - page.mainH1Count} H1 adicional fuera de \`main\`; revisar cabecera global.`);
    if (!page.title) blockers.push(`- \`${path}\`: sin título HTML.`);
    if (!page.description) recommendations.push(`- \`${path}\`: sin metadescripción.`);
    else if (page.description.length > 160) recommendations.push(`- \`${path}\`: metadescripción demasiado larga (${page.description.length} caracteres).`);
    if (!page.canonical) recommendations.push(`- \`${path}\`: sin canonical.`);
    if (Object.values(page.security).some((value) => !value)) recommendations.push(`- \`${path}\`: cabeceras de seguridad incompletas.`);
  }
  const rows = pages.map((page) => {
    const path = new URL(page.url).pathname;
    const headingSummary = page.headings.map(({ level, text }) => `H${level} ${text}`).join(' · ');
    return `| \`${escapeCell(path)}\` | ${page.status} | ${escapeCell(page.title)} | ${escapeCell(page.description)} | ${escapeCell(page.canonical)} | ${page.h1Count}/${page.mainH1Count} | ${escapeCell(headingSummary)} |`;
  });
  return `# Auditoría de preproducción de Aulós\n\nFecha: ${generatedAt}\nEntorno: \`staging8.aulos.es\` (lectura autenticada).\n\n## Bloqueantes\n\n${blockers.join('\n') || '- Ninguno detectado.'}\n\n## Recomendaciones\n\n${recommendations.join('\n') || '- Ninguna detectada.'}\n\n## Redirecciones\n\n${redirects.join('\n') || '- Ninguna detectada.'}\n\n## Inventario SEO y semántico\n\n| Ruta | HTTP | Título | Metadescripción | Canonical | H1 total/main | Encabezados |\n|---|---:|---|---|---|---:|---|\n${rows.join('\n')}\n`;
}

export function summarizeAudit(pages) {
  const editorial = pages.filter((page) => !(page.status >= 300 && page.status < 400 && page.redirect));
  return {
    totalH1Issues: editorial.filter((page) => page.mainH1Count !== 1).length,
    missingDescriptions: editorial.filter((page) => !page.description).length,
    missingCanonicals: editorial.filter((page) => !page.canonical).length,
  };
}
