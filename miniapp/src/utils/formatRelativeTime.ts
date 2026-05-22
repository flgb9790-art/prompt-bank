export function formatRelativeTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн. назад`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function formatRegistrationDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
