import { useEffect } from "react";

const APP_NAME = "Prompt Bank";

export function formatDocumentTitle(suffix?: string) {
  const part = suffix?.trim();
  return part ? `${APP_NAME} - ${part}` : APP_NAME;
}

export function setDocumentTitle(suffix?: string) {
  document.title = formatDocumentTitle(suffix);
}

export function useDocumentTitle(suffix?: string) {
  useEffect(() => {
    setDocumentTitle(suffix);
  }, [suffix]);
}

export function webRouteDocumentTitle(input: {
  path: string;
  activeTag?: string;
  activeCategory?: string;
  categories: Array<{ slug: string; name: string }>;
  selectedPromptTitle?: string;
  isAddModalOpen?: boolean;
}) {
  if (input.selectedPromptTitle) {
    return input.selectedPromptTitle;
  }
  if (input.isAddModalOpen) {
    return "Новый промпт";
  }

  if (input.path === "/") return "Главная";
  if (input.path === "/favorites") return "Избранное";
  if (input.path === "/categories") return "Категории";
  if (input.path === "/tags") return "Теги";
  if (input.path === "/recent") return "Последние";
  if (input.path === "/settings") return "Настройки";
  if (input.path === "/copied") return "Скопированные промпты";
  if (input.path === "/viewed") return "Просмотренные промпты";
  if (input.path === "/prompts") {
    if (input.activeTag) return `Тег: ${input.activeTag}`;
    if (input.activeCategory) {
      const category = input.categories.find((item) => item.slug === input.activeCategory);
      if (category) return category.name;
    }
    return "Все промпты";
  }

  return undefined;
}

export function miniRouteDocumentTitle(input: {
  tab: string;
  activeTag?: string;
  searchQuery?: string;
  selectedPromptTitle?: string;
  profileScreen?: "copied" | "viewed" | null;
}) {
  if (input.selectedPromptTitle) {
    return input.selectedPromptTitle;
  }
  if (input.profileScreen === "copied") return "Скопированные";
  if (input.profileScreen === "viewed") return "Просмотренные";
  if (input.tab === "home") return "Главная";
  if (input.tab === "prompts") {
    return input.activeTag ? `Тег: ${input.activeTag}` : "Промпты";
  }
  if (input.tab === "search") {
    const query = input.searchQuery?.trim();
    return query ? `Поиск: ${query}` : "Поиск";
  }
  if (input.tab === "favorites") return "Избранное";
  if (input.tab === "profile") return "Профиль";
  if (input.tab === "add") return "Новый промпт";
  return undefined;
}
