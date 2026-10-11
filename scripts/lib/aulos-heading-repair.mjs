export function planHeadingRepairs(audit) {
  return audit
    .filter((page) => page.mainH1Count > 1)
    .map((page) => {
      const path = new URL(page.url).pathname;
      return { path, removeEntryHeader: true, normalizeSiteTitle: path === '/' && page.h1Count > page.mainH1Count };
    });
}

export function repairRenderedHtml(html, repair) {
  let output = String(html);
  if (repair.removeEntryHeader) {
    output = output.replace(
      /<header\b[^>]*class=(['"])[^'"]*\bentry-header\b[^'"]*\1[^>]*>\s*<h1\b[^>]*class=(['"])[^'"]*\bentry-title\b[^'"]*\2[^>]*>[\s\S]*?<\/h1>\s*<\/header>/i,
      '',
    );
  }
  if (repair.normalizeSiteTitle) {
    output = output.replace(
      /<h1(\s+class=(['"])[^'"]*\bsite-title\b[^'"]*\2[^>]*)>([\s\S]*?)<\/h1>/i,
      '<p$1>$3</p>',
    );
  }
  return output;
}
