import {
  defaultPinterestDescriptionTemplate,
  defaultPinterestTitleTemplate,
  defaultTelegramPostTemplate
} from "./publicationTemplate";

export type PublicationTemplatesValue = {
  telegramPostTemplate: string;
  pinterestTitleTemplate: string;
  pinterestDescriptionTemplate: string;
};

const STORAGE_KEY = "prompt-bank-publication-templates-v1";

export function effectivePublicationTemplates(value: PublicationTemplatesValue): PublicationTemplatesValue {
  return {
    telegramPostTemplate: value.telegramPostTemplate.trim() || defaultTelegramPostTemplate(),
    pinterestTitleTemplate: value.pinterestTitleTemplate.trim() || defaultPinterestTitleTemplate(),
    pinterestDescriptionTemplate:
      value.pinterestDescriptionTemplate.trim() || defaultPinterestDescriptionTemplate()
  };
}

export function persistPublicationTemplatesFromPrompt(prompt: {
  telegramPostTemplate?: string | null;
  pinterestTitleTemplate?: string | null;
  pinterestDescriptionTemplate?: string | null;
}): void {
  const value: PublicationTemplatesValue = {
    telegramPostTemplate: prompt.telegramPostTemplate ?? "",
    pinterestTitleTemplate: prompt.pinterestTitleTemplate ?? "",
    pinterestDescriptionTemplate: prompt.pinterestDescriptionTemplate ?? ""
  };
  if (
    !value.telegramPostTemplate.trim() &&
    !value.pinterestTitleTemplate.trim() &&
    !value.pinterestDescriptionTemplate.trim()
  ) {
    return;
  }
  saveStoredPublicationTemplates(effectivePublicationTemplates(value));
}

export function loadStoredPublicationTemplates(): PublicationTemplatesValue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PublicationTemplatesValue>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      telegramPostTemplate: typeof parsed.telegramPostTemplate === "string" ? parsed.telegramPostTemplate : "",
      pinterestTitleTemplate: typeof parsed.pinterestTitleTemplate === "string" ? parsed.pinterestTitleTemplate : "",
      pinterestDescriptionTemplate:
        typeof parsed.pinterestDescriptionTemplate === "string" ? parsed.pinterestDescriptionTemplate : ""
    };
  } catch {
    return null;
  }
}

export function saveStoredPublicationTemplates(value: PublicationTemplatesValue): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}
