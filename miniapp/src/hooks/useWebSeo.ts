import { useEffect } from "react";
import type { Prompt } from "../types";
import {
  applyDefaultSiteSeo,
  applyPrivateRouteSeo,
  applyPromptSeo,
  applySeo,
  truncateSeoText
} from "../utils/seo";
import { webRouteDocumentTitle } from "../utils/documentTitle";

type Input = {
  path: string;
  activeTag?: string;
  activeCategory?: string;
  categories: Array<{ slug: string; name: string }>;
  selectedPrompt?: Prompt;
  isAddModalOpen?: boolean;
};

const PRIVATE_PATHS = new Set(["/favorites", "/settings", "/copied", "/viewed"]);

export function useWebSeo(input: Input) {
  useEffect(() => {
    if (input.selectedPrompt) {
      applyPromptSeo(input.selectedPrompt);
      return;
    }

    if (input.isAddModalOpen) {
      applyPrivateRouteSeo("Новый промпт", input.path);
      return;
    }

    if (PRIVATE_PATHS.has(input.path)) {
      const title = webRouteDocumentTitle({
        path: input.path,
        activeTag: input.activeTag,
        activeCategory: input.activeCategory,
        categories: input.categories
      });
      applyPrivateRouteSeo(title ?? "Prompt Bank", input.path);
      return;
    }

    const routeTitle = webRouteDocumentTitle({
      path: input.path,
      activeTag: input.activeTag,
      activeCategory: input.activeCategory,
      categories: input.categories
    });

    if (!routeTitle || routeTitle === "Главная") {
      applyDefaultSiteSeo(input.path);
      return;
    }

    const description =
      input.path === "/prompts" && input.activeTag
        ? truncateSeoText(`Промпты с тегом ${input.activeTag} в Prompt Bank.`)
        : input.path === "/prompts" && input.activeCategory
          ? truncateSeoText(
              `Промпты в категории ${
                input.categories.find((item) => item.slug === input.activeCategory)?.name ?? input.activeCategory
              } в Prompt Bank.`
            )
          : truncateSeoText(`${routeTitle} — коллекция готовых промптов в Prompt Bank.`);

    applySeo({
      title: routeTitle,
      description,
      canonicalPath: input.path,
      robots: "index,follow"
    });
  }, [
    input.path,
    input.activeTag,
    input.activeCategory,
    input.categories,
    input.selectedPrompt,
    input.isAddModalOpen
  ]);
}
