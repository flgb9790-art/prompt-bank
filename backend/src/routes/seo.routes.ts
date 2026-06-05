import { Router } from "express";
import { config } from "../config";
import { prisma } from "../db";
import { PromptService } from "../services/prompt.service";
import { buildPromptPublicUrl, buildPromptSeoHtml, isSearchBot } from "../utils/seoHtml";

const router = Router();

const PUBLIC_PAGES = ["/", "/prompts", "/categories", "/tags", "/recent", "/privacy"];

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function buildSitemapXml() {
  const siteOrigin = config.webAppUrl;
  const prompts = await prisma.prompt.findMany({
    select: { id: true, updatedAt: true },
    orderBy: { id: "asc" }
  });

  const urls = [
    ...PUBLIC_PAGES.map((path) => ({
      loc: `${siteOrigin}${path === "/" ? "" : path}`,
      lastmod: new Date().toISOString()
    })),
    ...prompts.map((prompt) => ({
      loc: buildPromptPublicUrl(siteOrigin, prompt.id),
      lastmod: prompt.updatedAt.toISOString()
    }))
  ];

  const body = urls
    .map(
      (entry) =>
        `  <url>\n    <loc>${xmlEscape(entry.loc)}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

router.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(
    `User-agent: *\nAllow: /\nDisallow: /favorites\nDisallow: /settings\nDisallow: /copied\nDisallow: /viewed\n\nSitemap: ${config.webAppUrl}/sitemap.xml\n`
  );
});

router.get("/sitemap.xml", async (_req, res, next) => {
  try {
    const xml = await buildSitemapXml();
    res.type("application/xml").send(xml);
  } catch (error) {
    next(error);
  }
});

export async function tryServePromptSeoPage(
  req: { path: string; get: (name: string) => string | undefined },
  res: { type: (value: string) => { send: (body: string) => void } }
): Promise<boolean> {
  const match = /^\/p\/(\d+)\/?$/.exec(req.path);
  if (!match || !isSearchBot(req.get("user-agent"))) {
    return false;
  }

  const promptId = Number(match[1]);
  const prompt = await PromptService.getById(promptId);
  if (!prompt) {
    return false;
  }

  res
    .type("text/html; charset=utf-8")
    .send(buildPromptSeoHtml(config.webAppUrl, config.publicBackendUrl, prompt as any));
  return true;
}

export default router;
