type SeoPrompt = {
  id: number;
  title?: string | null;
  content?: string;
  contentExcerpt?: string;
  category?: { name?: string | null };
  coverMediaUrl?: string | null;
  updatedAt?: string | Date;
  createdAt?: string | Date;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(value: string, max = 160) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function promptTitle(prompt: SeoPrompt) {
  const text = prompt.contentExcerpt ?? prompt.content ?? prompt.title ?? "";
  const firstLine = text.trim().split(/\r?\n/).find(Boolean) ?? "Промпт";
  return truncate(firstLine, 100);
}

function promptDescription(prompt: SeoPrompt) {
  return truncate(prompt.contentExcerpt ?? prompt.content ?? promptTitle(prompt), 160);
}

export function buildPromptPublicUrl(siteOrigin: string, promptId: number) {
  return `${siteOrigin.replace(/\/$/, "")}/p/${promptId}`;
}

export function buildPromptSeoHtml(siteOrigin: string, mediaOrigin: string, prompt: SeoPrompt) {
  const title = promptTitle(prompt);
  const description = promptDescription(prompt);
  const canonical = buildPromptPublicUrl(siteOrigin, prompt.id);
  const image = prompt.coverMediaUrl
    ? prompt.coverMediaUrl.startsWith("http")
      ? prompt.coverMediaUrl
      : `${mediaOrigin.replace(/\/$/, "")}${prompt.coverMediaUrl.startsWith("/") ? "" : "/"}${prompt.coverMediaUrl}`
    : "";
  const body = escapeHtml(prompt.contentExcerpt ?? prompt.content ?? description);
  const category = escapeHtml(prompt.category?.name ?? "Prompt Bank");

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Prompt Bank — ${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Prompt Bank" />
    <meta property="og:locale" content="ru_RU" />
    <meta property="og:title" content="Prompt Bank — ${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonical}" />
    ${image ? `<meta property="og:image" content="${image}" />` : ""}
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: title,
      description,
      url: canonical,
      genre: prompt.category?.name,
      image: image || undefined,
      datePublished: prompt.createdAt,
      dateModified: prompt.updatedAt
    })}</script>
    <meta http-equiv="refresh" content="0;url=${canonical}" />
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p><strong>Категория:</strong> ${category}</p>
      <article><pre>${body}</pre></article>
      <p><a href="${canonical}">Открыть в Prompt Bank</a></p>
    </main>
  </body>
</html>`;
}

export function isSearchBot(userAgent: string | undefined) {
  if (!userAgent) return false;
  return /bot|crawl|spider|slurp|mediapartners|bingpreview|facebookexternalhit|linkedinbot|twitterbot|telegrambot/i.test(
    userAgent
  );
}
