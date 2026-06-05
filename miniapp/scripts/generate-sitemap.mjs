import { writeFileSync } from "node:fs";
import { join } from "node:path";

const distDir = process.argv[2] || "dist";
const siteUrl = (process.env.VITE_SITE_URL || "https://prompt-bank.one").replace(/\/$/, "");
const backendUrl = (process.env.VITE_BACKEND_URL || process.env.BACKEND_URL || "").replace(/\/$/, "");

function xmlEscape(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchSitemapFromBackend() {
  if (!backendUrl) return null;
  const response = await fetch(`${backendUrl}/sitemap.xml`);
  if (!response.ok) return null;
  return response.text();
}

async function fetchPromptUrls() {
  if (!backendUrl) return [];
  const items = [];
  const limit = 200;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const response = await fetch(`${backendUrl}/api/prompts?limit=${limit}&offset=${offset}&lite=1&total=1`);
    if (!response.ok) break;
    const payload = await response.json();
    items.push(...payload.items);
    total = payload.total ?? items.length;
    offset += limit;
    if (!payload.items.length) break;
  }

  return items.map((item) => ({
    loc: `${siteUrl}/p/${item.id}`,
    lastmod: item.updatedAt || new Date().toISOString()
  }));
}

async function buildSitemapXml() {
  const fromBackend = await fetchSitemapFromBackend();
  if (fromBackend) return fromBackend;

  const staticPages = ["/", "/prompts", "/categories", "/tags", "/recent", "/privacy"].map((path) => ({
    loc: `${siteUrl}${path === "/" ? "" : path}`,
    lastmod: new Date().toISOString()
  }));
  const promptPages = await fetchPromptUrls();
  const urls = [...staticPages, ...promptPages];
  const body = urls
    .map(
      (entry) =>
        `  <url>\n    <loc>${xmlEscape(entry.loc)}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

const xml = await buildSitemapXml();
const outPath = join(distDir, "sitemap.xml");
writeFileSync(outPath, xml, "utf8");
console.log(`Wrote ${outPath}`);
