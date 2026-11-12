import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { prisma } from "../db";
import { config } from "../config";
import { missingPinterestScopes, requirePinterestScopes } from "../utils/pinterestScopes";
import { getPinterestEnvironment, requirePinterestEnvironment } from "../utils/pinterestEnvironment";

export const CONNECTION_ID = "publisher";
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function encryptionKey(): Buffer {
  if (!/^[a-f0-9]{64}$/i.test(config.pinterestTokenEncryptionKey)) {
    throw new Error("Подключение Pinterest не настроено: требуется PINTEREST_TOKEN_ENCRYPTION_KEY (64 hex-символа).");
  }
  return Buffer.from(config.pinterestTokenEncryptionKey, "hex");
}
export function encryptToken(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64url")).join(".");
}
export function decryptToken(value: string): string {
  const [iv, tag, data] = value.split(".").map(part => Buffer.from(part, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
}

export type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
export async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const { apiBaseUrl } = getPinterestEnvironment(config.pinterestApiBaseUrl);
  const response = await fetch(`${apiBaseUrl}/oauth/token`, {
    method: "POST", signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Basic ${Buffer.from(`${config.pinterestClientId}:${config.pinterestClientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString()
  });
  if (!response.ok) throw new Error("Pinterest не подтвердил подключение. Подключите аккаунт ещё раз.");
  let token: TokenResponse;
  try { token = await response.json() as TokenResponse; }
  catch { throw new Error("Pinterest вернул некорректный ответ подключения. Попробуйте ещё раз."); }
  if (typeof token.access_token !== "string" || !token.access_token) throw new Error("Pinterest не вернул токен подключения.");
  if (token.expires_in !== undefined && (!Number.isFinite(token.expires_in) || token.expires_in <= 0)) {
    throw new Error("Pinterest вернул некорректный срок подключения.");
  }
  return token;
}

export async function saveConnection(ownerTelegramId: string, token: TokenResponse, stateHash: string) {
  requirePinterestScopes(token.scope);
  const { apiBaseUrl } = getPinterestEnvironment(config.pinterestApiBaseUrl);
  const data = {
    ownerTelegramId, accessTokenEncrypted: encryptToken(token.access_token),
    refreshTokenEncrypted: token.refresh_token ? encryptToken(token.refresh_token) : null,
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
    scope: token.scope || null, apiBaseUrl, boardId: null, boardName: null
  };
  await prisma.$transaction(async tx => {
    const consumed = await tx.pinterestOAuthState.deleteMany({ where: { stateHash, ownerTelegramId, expiresAt: { gt: new Date() } } });
    if (consumed.count !== 1) throw new Error("Подключение отменено, истекло или уже использовано. Начните заново.");
    await tx.pinterestConnection.upsert({ where: { id: CONNECTION_ID }, create: { id: CONNECTION_ID, ...data }, update: data });
  });
}

let refreshing: Promise<void> | undefined;
async function refreshConnection() {
  const { apiBaseUrl } = getPinterestEnvironment(config.pinterestApiBaseUrl);
  const row = await prisma.pinterestConnection.findUnique({ where: { id: CONNECTION_ID } });
  if (!row?.refreshTokenEncrypted) throw new Error("Срок подключения Pinterest истёк. Подключите аккаунт заново.");
  requirePinterestEnvironment(row.apiBaseUrl, apiBaseUrl);
  const token = await requestToken(new URLSearchParams({ grant_type: "refresh_token", refresh_token: decryptToken(row.refreshTokenEncrypted) }));
  const scope = token.scope ?? row.scope;
  if (missingPinterestScopes(scope).length) {
    // Keep the old credentials, but remember that this grant now needs new consent.
    const result = await prisma.pinterestConnection.updateMany({
      where: { id: CONNECTION_ID, accessTokenEncrypted: row.accessTokenEncrypted }, data: { scope }
    });
    if (!result.count) throw new Error("Подключение Pinterest изменилось. Повторите действие.");
  }
  requirePinterestScopes(scope);
  // A disconnect or newer OAuth connection must win over an in-flight refresh.
  const result = await prisma.pinterestConnection.updateMany({
    where: { id: CONNECTION_ID, accessTokenEncrypted: row.accessTokenEncrypted },
    data: { accessTokenEncrypted: encryptToken(token.access_token),
      refreshTokenEncrypted: token.refresh_token ? encryptToken(token.refresh_token) : row.refreshTokenEncrypted,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null, scope }
  });
  if (!result.count) throw new Error("Подключение Pinterest изменилось. Повторите действие.");
}
export async function getPinterestCredentials(): Promise<{ accessToken: string; boardId: string; boardName: string; apiBaseUrl: string }> {
  const { apiBaseUrl } = getPinterestEnvironment(config.pinterestApiBaseUrl);
  let row = await prisma.pinterestConnection.findUnique({ where: { id: CONNECTION_ID } });
  // Existing operator-managed installation remains available until explicitly connected/disconnected.
  if (!row) return { accessToken: config.pinterestAccessToken, boardId: config.pinterestBoardId, boardName: config.pinterestBoardId, apiBaseUrl };
  if (!row.accessTokenEncrypted) throw new Error("Pinterest отключён. Подключите аккаунт в настройках.");
  requirePinterestEnvironment(row.apiBaseUrl, apiBaseUrl);
  // Refresh cannot add permissions to an older OAuth grant.
  requirePinterestScopes(row.scope);
  if (row.expiresAt && row.expiresAt.getTime() < Date.now() + 60000) {
    if (!refreshing) refreshing = refreshConnection().finally(() => { refreshing = undefined; });
    await refreshing;
    row = await prisma.pinterestConnection.findUniqueOrThrow({ where: { id: CONNECTION_ID } });
  }
  if (!row.accessTokenEncrypted) throw new Error("Pinterest отключён.");
  requirePinterestEnvironment(row.apiBaseUrl, apiBaseUrl);
  requirePinterestScopes(row.scope);
  return { accessToken: decryptToken(row.accessTokenEncrypted), boardId: row.boardId || "", boardName: row.boardName || "", apiBaseUrl };
}

export async function pinterestGet(path: string) {
  const { accessToken, apiBaseUrl } = await getPinterestCredentials();
  if (!accessToken) throw new Error("Подключите Pinterest в настройках.");
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error("Не удалось получить доски Pinterest. Проверьте подключение и разрешения.");
  return response.json();
}

export async function connectionStatus() {
  const environment = getPinterestEnvironment(config.pinterestApiBaseUrl);
  const row = await prisma.pinterestConnection.findUnique({ where: { id: CONNECTION_ID } });
  const missingScopes = row?.accessTokenEncrypted ? missingPinterestScopes(row.scope) : [];
  const environmentMismatch = Boolean(row?.accessTokenEncrypted && row.apiBaseUrl !== environment.apiBaseUrl);
  return { connected: Boolean(row?.accessTokenEncrypted),
    legacyConfigured: !row && Boolean(config.pinterestAccessToken),
    configured: Boolean(config.pinterestClientId && config.pinterestClientSecret && config.pinterestRedirectUri && /^[a-f0-9]{64}$/i.test(config.pinterestTokenEncryptionKey)),
    boardId: row ? row.boardId : config.pinterestBoardId || null,
    boardName: row ? row.boardName : config.pinterestBoardId || null,
    missingScopes, environment: environment.name, environmentMismatch,
    needsReconnect: environmentMismatch || missingScopes.length > 0 || Boolean(row?.accessTokenEncrypted && row.expiresAt && row.expiresAt.getTime() < Date.now() && !row.refreshTokenEncrypted) };
}
