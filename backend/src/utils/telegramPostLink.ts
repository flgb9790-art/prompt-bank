const POST_LINK_ERROR = "Укажите ссылку на конкретный Telegram-пост, например https://t.me/channel/123. Ссылка на канал не подходит.";

export function parseTelegramPostLink(value: unknown): { url: string; messageId: string; chatId: string | null } {
  if (typeof value !== "string") throw new Error(POST_LINK_ERROR);
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error(POST_LINK_ERROR); }
  if (url.protocol !== "https:" || url.hostname !== "t.me" || url.port || url.username || url.password) {
    throw new Error(POST_LINK_ERROR);
  }
  const match = url.pathname.match(/^\/(?:([a-zA-Z][a-zA-Z0-9_]{3,31})|c\/([1-9]\d*))\/([1-9]\d*)\/?$/);
  if (!match || ["share", "joinchat", "proxy", "socks", "login"].includes(match[1]?.toLowerCase())) {
    throw new Error(POST_LINK_ERROR);
  }
  return {
    url: `https://t.me/${match[1] || `c/${match[2]}`}/${match[3]}`,
    messageId: match[3],
    chatId: match[2] ? `-100${match[2]}` : null
  };
}

export function buildTelegramPostLink(chat: { id: number | string; username?: string }, messageId: number): string {
  if (chat.username) return parseTelegramPostLink(`https://t.me/${chat.username}/${messageId}`).url;
  const id = String(chat.id);
  if (!/^-100[1-9]\d*$/.test(id)) throw new Error("Не удалось определить ссылку на сообщение Telegram-канала.");
  return parseTelegramPostLink(`https://t.me/c/${id.slice(4)}/${messageId}`).url;
}
