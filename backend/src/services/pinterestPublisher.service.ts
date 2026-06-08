import { prisma } from "../db";
import { config } from "../config";
import { PromptService } from "./prompt.service";
import { resolvePublicMediaUrl } from "./telegramPublisher.service";
import { derivePromptTitle } from "../utils/promptTitle";
import {
  type PublicationTemplateVars,
  resolvePinterestDescriptionTemplate,
  resolvePinterestTitleTemplate
} from "../utils/publicationTemplate";
import { htmlToPlainText, isHtmlTemplate } from "../utils/templateHtml";

const PINTEREST_TITLE_MAX = 100;
const PINTEREST_DESCRIPTION_MAX = 800;

type PromptForPin = {
  id: number;
  title: string;
  content: string;
  pinterestTitleTemplate?: string | null;
  pinterestDescriptionTemplate?: string | null;
  coverMediaUrl: string | null;
  coverMediaType: string | null;
  category: { name: string };
  examples: Array<{ url: string; type: string }>;
};

export type PinterestPinOverrides = {
  title?: string;
  description?: string;
  link?: string;
};

type PinterestPinResult = {
  id: string;
  link?: string;
};

export function defaultPinterestDescription(categoryName: string): string {
  return `Готовый промпт для ${categoryName}.\nБольше промптов и подборок в нашем Telegram-канале.`;
}

export function truncatePinterestTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error("Pinterest publication failed: title is empty");
  }
  if (trimmed.length <= PINTEREST_TITLE_MAX) return trimmed;
  return `${trimmed.slice(0, PINTEREST_TITLE_MAX - 1)}…`;
}

function truncatePinterestDescription(text: string): string {
  if (text.length <= PINTEREST_DESCRIPTION_MAX) return text;
  return `${text.slice(0, PINTEREST_DESCRIPTION_MAX - 1)}…`;
}

function validatePinterestLink(link: string): void {
  const trimmed = link.trim();
  if (!trimmed) {
    throw new Error("Pinterest link is missing");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Pinterest link is invalid");
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new Error("Pinterest link is invalid");
  }
}

function resolveTemplatePinContent(prompt: PromptForPin) {
  const telegramChannelUrl = config.telegramChannelUrl.trim();
  const vars: PublicationTemplateVars = {
    headline: derivePromptTitle(prompt.content),
    category: prompt.category.name,
    hashtags: "",
    link: telegramChannelUrl,
    channel: telegramChannelUrl
  };
  const title = truncatePinterestTitle(resolvePinterestTitleTemplate(prompt.pinterestTitleTemplate, vars));
  const descriptionRaw = resolvePinterestDescriptionTemplate(prompt.pinterestDescriptionTemplate, vars);
  const description = truncatePinterestDescription(
    isHtmlTemplate(descriptionRaw) ? htmlToPlainText(descriptionRaw) : descriptionRaw
  );
  const destinationLink = telegramChannelUrl;
  validatePinterestLink(destinationLink);
  return { title, description, destinationLink };
}

function resolveOverridePinContent(prompt: PromptForPin, overrides: PinterestPinOverrides) {
  const categoryName = prompt.category.name;
  const title = truncatePinterestTitle(overrides.title?.trim() || prompt.title.trim() || derivePromptTitle(prompt.content));
  const description = truncatePinterestDescription(
    overrides.description?.trim() || defaultPinterestDescription(categoryName)
  );
  const destinationLink = overrides.link?.trim() || config.telegramChannelUrl.trim();
  validatePinterestLink(destinationLink);
  return { title, description, destinationLink };
}

export function buildPinterestPin(prompt: PromptForPin, overrides?: PinterestPinOverrides) {
  if (overrides !== undefined) {
    return resolveOverridePinContent(prompt, overrides);
  }
  return resolveTemplatePinContent(prompt);
}

export function selectPinterestMedia(prompt: PromptForPin): { url: string; mediaType: "image" } {
  if (prompt.coverMediaType === "image" && prompt.coverMediaUrl) {
    const url = resolvePublicMediaUrl(prompt.coverMediaUrl);
    if (url) return { url, mediaType: "image" };
  }

  for (const example of prompt.examples) {
    if (example.type === "image") {
      const url = resolvePublicMediaUrl(example.url);
      if (url) return { url, mediaType: "image" };
    }
  }

  if (prompt.coverMediaType === "video" || prompt.examples.some((item) => item.type === "video")) {
    throw new Error("Pinterest publication requires image media in MVP");
  }

  throw new Error("Pinterest publication failed: no image media found");
}

async function createPinterestPin(payload: {
  title: string;
  description: string;
  destinationLink: string;
  imageUrl: string;
}): Promise<PinterestPinResult> {
  const token = config.pinterestAccessToken;
  if (!token) {
    throw new Error("PINTEREST_ACCESS_TOKEN не указан");
  }
  if (!config.pinterestBoardId) {
    throw new Error("PINTEREST_BOARD_ID не указан");
  }

  const response = await fetch(`${config.pinterestApiBaseUrl}/pins`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      board_id: config.pinterestBoardId,
      title: payload.title,
      description: payload.description,
      link: payload.destinationLink,
      media_source: {
        source_type: "image_url",
        url: payload.imageUrl
      }
    })
  });

  let data: PinterestPinResult & { message?: string; code?: number };
  try {
    data = (await response.json()) as PinterestPinResult & { message?: string; code?: number };
  } catch {
    throw new Error("Pinterest API error: invalid response");
  }

  if (!response.ok || !data.id) {
    const message = data.message || `Pinterest API error (${response.status})`;
    throw new Error(message);
  }

  return data;
}

export async function getLatestPinterestPublication(promptId: number) {
  return prisma.pinterestPublication.findFirst({
    where: { promptId },
    orderBy: { createdAt: "desc" }
  });
}

function resolvePublicationOverrides(
  explicit?: PinterestPinOverrides,
  latest?: {
    title: string;
    description: string;
    destinationLink: string;
  } | null
): PinterestPinOverrides | undefined {
  if (explicit !== undefined) {
    return explicit;
  }
  if (latest?.title?.trim() && latest.destinationLink?.trim()) {
    return {
      title: latest.title,
      description: latest.description,
      link: latest.destinationLink
    };
  }
  return undefined;
}

export async function sendPromptToPinterest(promptId: number, overrides?: PinterestPinOverrides) {
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: {
      category: true,
      examples: { orderBy: { id: "asc" } }
    }
  });

  if (!prompt) {
    throw new Error("Prompt not found");
  }

  const latestPublication = overrides === undefined ? await getLatestPinterestPublication(promptId) : null;
  const effectiveOverrides = resolvePublicationOverrides(overrides, latestPublication);

  let pinContent: ReturnType<typeof buildPinterestPin>;
  try {
    pinContent = buildPinterestPin(prompt, effectiveOverrides);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const publication = await prisma.pinterestPublication.create({
      data: {
        promptId,
        status: "failed",
        error: message,
        title: prompt.title.slice(0, PINTEREST_TITLE_MAX) || "Prompt",
        description: effectiveOverrides?.description?.trim() || defaultPinterestDescription(prompt.category.name),
        destinationLink: effectiveOverrides?.link?.trim() || config.telegramChannelUrl || ""
      }
    });
    PromptService.invalidateDetailCache(promptId);
    return { status: "failed" as const, error: message, publication };
  }

  let media: { url: string; mediaType: "image" };
  try {
    media = selectPinterestMedia(prompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const publication = await prisma.pinterestPublication.create({
      data: {
        promptId,
        status: "failed",
        error: message,
        title: pinContent.title,
        description: pinContent.description,
        destinationLink: pinContent.destinationLink
      }
    });

    await prisma.prompt.update({
      where: { id: promptId },
      data: { pinterestPublished: false }
    });

    PromptService.invalidateDetailCache(promptId);
    return { status: "failed" as const, error: message, publication };
  }

  const publication = await prisma.pinterestPublication.create({
    data: {
      promptId,
      status: "pending",
      title: pinContent.title,
      description: pinContent.description,
      destinationLink: pinContent.destinationLink,
      mediaType: media.mediaType,
      mediaUrl: media.url
    }
  });

  try {
    const result = await createPinterestPin({
      title: pinContent.title,
      description: pinContent.description,
      destinationLink: pinContent.destinationLink,
      imageUrl: media.url
    });

    const publishedUrl = result.link || `https://www.pinterest.com/pin/${result.id}/`;

    await prisma.$transaction([
      prisma.pinterestPublication.update({
        where: { id: publication.id },
        data: {
          status: "published",
          pinterestPinId: result.id,
          pinterestBoardId: config.pinterestBoardId,
          publishedUrl,
          publishedAt: new Date()
        }
      }),
      prisma.prompt.update({
        where: { id: promptId },
        data: { pinterestPublished: true }
      })
    ]);

    const updated = await getLatestPinterestPublication(promptId);
    PromptService.invalidateDetailCache(promptId);
    return { status: "published" as const, publication: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Pinterest publish failed for prompt ${promptId}:`, message);

    await prisma.$transaction([
      prisma.pinterestPublication.update({
        where: { id: publication.id },
        data: {
          status: "failed",
          error: message
        }
      }),
      prisma.prompt.update({
        where: { id: promptId },
        data: { pinterestPublished: false }
      })
    ]);

    const updated = await getLatestPinterestPublication(promptId);
    PromptService.invalidateDetailCache(promptId);
    return { status: "failed" as const, error: message, publication: updated };
  }
}
