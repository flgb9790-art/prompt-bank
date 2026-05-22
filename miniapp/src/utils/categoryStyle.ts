export function getCategoryBadgeClass(slug: string, name: string): string {
  const key = `${slug} ${name}`.toLowerCase();
  if (key.includes("video")) return "badge-video";
  if (key.includes("image") || key.includes("photo")) return "badge-image";
  if (key.includes("cursor") || key.includes("codex")) return "badge-cursor";
  if (key.includes("telegram") || key.includes("bot")) return "badge-bot";
  return "badge-default";
}

export function formatPromptDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
