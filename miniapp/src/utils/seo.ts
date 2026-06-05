import type { Prompt } from "../types";
import { resolveMediaUrl } from "../api";
import { getPromptExcerpt } from "./promptContent";
import { getPromptLabel } from "./promptTitle";
import { buildPromptPublicUrl, getSiteOrigin } from "./siteUrl";

const APP_NAME = "Prompt Bank";
const DEFAULT_DESCRIPTION =
  "Prompt Bank — банк готовых промптов для изображений, видео, Cursor, Telegram и маркетинга. Ищите, копируйте и сохраняйте лучшие промпты.";

type SeoInput = {
  title?: string;
  description?: string;
  canonicalPath?: string;
  imageUrl?: string;
  robots?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

let jsonLdNode: HTMLScriptElement | null = null;

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  if (!content) return;
  const selector = `meta[${attr}="${key}"]`;
  let node = document.head.querySelector<HTMLMetaElement>(selector);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attr, key);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  if (!href) return;
  let node = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", "canonical");
    document.head.appendChild(node);
  }
  node.setAttribute("href", href);
}

function upsertJsonLd(data?: Record<string, unknown> | Record<string, unknown>[]) {
  if (jsonLdNode?.parentNode) {
    jsonLdNode.parentNode.removeChild(jsonLdNode);
    jsonLdNode = null;
  }
  if (!data) return;
  jsonLdNode = document.createElement("script");
  jsonLdNode.type = "application/ld+json";
  jsonLdNode.textContent = JSON.stringify(data);
  document.head.appendChild(jsonLdNode);
}

export function truncateSeoText(value: string, maxLength = 160): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function buildPromptSeo(prompt: Prompt) {
  const title = getPromptLabel(prompt);
  const description = truncateSeoText(getPromptExcerpt(prompt) || title, 160);
  const canonicalUrl = buildPromptPublicUrl(prompt.id);
  const imageUrl = prompt.coverMediaUrl ? resolveMediaUrl(prompt.coverMediaUrl) : undefined;
  const keywords = prompt.keywords?.map((item) => item.keyword.name).filter(Boolean) ?? [];

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: title,
    description,
    url: canonicalUrl,
    datePublished: prompt.createdAt,
    dateModified: prompt.updatedAt,
    keywords: keywords.length ? keywords.join(", ") : undefined,
    genre: prompt.category?.name,
    image: imageUrl,
    isPartOf: {
      "@type": "WebSite",
      name: APP_NAME,
      url: getSiteOrigin()
    }
  };

  return {
    title,
    description,
    canonicalUrl,
    imageUrl,
    jsonLd
  };
}

export function applySeo(input: SeoInput) {
  if (typeof document === "undefined") return;

  const title = input.title?.trim();
  const description = input.description?.trim() || DEFAULT_DESCRIPTION;
  const canonical = input.canonicalPath
    ? `${getSiteOrigin()}${input.canonicalPath.startsWith("/") ? input.canonicalPath : `/${input.canonicalPath}`}`
    : getSiteOrigin();

  document.title = title ? `${APP_NAME} - ${title}` : APP_NAME;

  upsertMeta("name", "description", description);
  upsertMeta("name", "robots", input.robots ?? "index,follow");
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:site_name", APP_NAME);
  upsertMeta("property", "og:locale", "ru_RU");
  upsertMeta("property", "og:title", title ? `${APP_NAME} - ${title}` : APP_NAME);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:url", canonical);
  if (input.imageUrl) {
    upsertMeta("property", "og:image", input.imageUrl);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:image", input.imageUrl);
  } else {
    upsertMeta("name", "twitter:card", "summary");
  }
  upsertMeta("name", "twitter:title", title ? `${APP_NAME} - ${title}` : APP_NAME);
  upsertMeta("name", "twitter:description", description);

  upsertCanonical(canonical);
  upsertJsonLd(input.jsonLd);
}

export function applyDefaultSiteSeo(path = "/") {
  applySeo({
    title: undefined,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: path,
    robots: "index,follow",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: APP_NAME,
      url: getSiteOrigin(),
      description: DEFAULT_DESCRIPTION,
      inLanguage: "ru-RU"
    }
  });
}

export function applyPrivateRouteSeo(title: string, path: string) {
  applySeo({
    title,
    canonicalPath: path,
    robots: "noindex,nofollow"
  });
}

export function applyPromptSeo(prompt: Prompt) {
  const seo = buildPromptSeo(prompt);
  applySeo({
    title: seo.title,
    description: seo.description,
    canonicalPath: `/p/${prompt.id}`,
    imageUrl: seo.imageUrl,
    robots: "index,follow",
    jsonLd: seo.jsonLd
  });
}
