import { config } from "../config";

export function buildPinterestAuthUrl(state: string): string {
  if (!config.pinterestClientId || !config.pinterestClientSecret || !config.pinterestRedirectUri) {
    throw new Error("Pinterest OAuth не настроен на сервере.");
  }
  return `https://www.pinterest.com/oauth/?${new URLSearchParams({
    client_id: config.pinterestClientId, redirect_uri: config.pinterestRedirectUri,
    response_type: "code", scope: "boards:read,pins:write", state
  })}`;
}
function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
export function renderPinterestOAuthHtml(input: {title: string; message: string; isError?: boolean}): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escapeHtml(input.title)}</title>
  <style>body{margin:0;background:#100d19;color:#eee5f7;font:400 16px/1.65 system-ui}main{max-width:640px;margin:12vh auto;padding:28px;border:1px solid #493455;border-radius:20px;background:linear-gradient(120deg,#302042,#191322)}h1{font-size:24px;font-weight:500}a{color:#d1adff}</style></head>
  <body><main><h1>${escapeHtml(input.title)}</h1><p>${escapeHtml(input.message)}</p><a href="${escapeHtml(config.webAppUrl)}/settings">Вернуться в настройки Prompt Bank</a></main></body></html>`;
}
