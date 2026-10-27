import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes } from "node:crypto";
import { config } from "../config";
import { isAdminRequest, readTelegramId, authRequired } from "../auth";
import { prisma } from "../db";
import { buildPinterestAuthUrl, renderPinterestOAuthHtml } from "../services/pinterestOAuth.service";
import { CONNECTION_ID, digest, encryptToken, requestToken, saveConnection, connectionStatus, pinterestGet } from "../services/pinterestConnection.service";

const router = Router();
const COOKIE = "pb_pinterest_oauth";
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/pinterest" };
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); res.setHeader("Referrer-Policy", "no-referrer"); next(); });
function admin(req: Request, res: Response, next: NextFunction) {
  if (!isAdminRequest(req)) return res.status(403).json({ message: "Только администратор может управлять Pinterest" });
  next();
}
router.get("/status", authRequired, admin, async (_req, res, next) => {
  try { res.json(await connectionStatus()); } catch (error) { next(error); }
});
router.post("/connect", authRequired, admin, async (req, res, next) => {
  try {
    // Validate encryption configuration before sending the administrator to Pinterest.
    encryptToken("configuration-check");
    const state = randomBytes(32).toString("base64url");
    const browser = randomBytes(32).toString("base64url");
    buildPinterestAuthUrl(state); // Check OAuth configuration before creating a pending connection.
    await prisma.pinterestOAuthState.deleteMany({ where: { OR: [
      { expiresAt: { lt: new Date() } }, { ownerTelegramId: readTelegramId(req)! }
    ] } });
    await prisma.pinterestOAuthState.create({ data: { stateHash: digest(state), browserHash: digest(browser),
      ownerTelegramId: readTelegramId(req)!, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
    // The API and registered callback may use different public hostnames.
    // Establish the browser cookie on the callback origin before leaving for Pinterest.
    const authorize = new URL("/api/pinterest/authorize", config.pinterestRedirectUri);
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("browser", browser);
    const url = authorize.toString();
    res.json({ url });
  } catch (error) { next(error); }
});
router.get("/authorize", async (req, res) => {
  try {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const browser = typeof req.query.browser === "string" ? req.query.browser : "";
    if (!state || !browser) throw new Error("Начните подключение из настроек Prompt Bank.");
    const saved = await prisma.pinterestOAuthState.findUnique({ where: { stateHash: digest(state) } });
    if (!saved || saved.browserHash !== digest(browser) || saved.expiresAt.getTime() <= Date.now() || !config.adminTelegramIds.includes(saved.ownerTelegramId)) {
      throw new Error("Попытка подключения недействительна или истекла. Начните заново.");
    }
    res.cookie(COOKIE, browser, { ...cookieOptions, maxAge: Math.max(0, saved.expiresAt.getTime() - Date.now()) });
    res.redirect(303, buildPinterestAuthUrl(state));
  } catch (error) {
    res.status(400).type("html").send(renderPinterestOAuthHtml({ title: "Pinterest не подключён",
      message: error instanceof Error ? error.message : "Начните подключение заново из настроек.", isError: true }));
  }
});
router.get("/callback", async (req, res) => {
  try {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const browser = req.headers.cookie?.split(";").map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || "";
    if (!state || !browser) throw new Error("Недействительная попытка подключения. Начните заново из настроек.");
    const stateHash = digest(state);
    const saved = await prisma.pinterestOAuthState.findUnique({ where: { stateHash } });
    if (!saved || saved.browserHash !== digest(browser) || saved.expiresAt.getTime() <= Date.now() || !config.adminTelegramIds.includes(saved.ownerTelegramId)) {
      throw new Error("Попытка подключения истекла или не соответствует браузеру. Начните заново.");
    }
    res.clearCookie(COOKIE, cookieOptions);
    if (req.query.error) {
      await prisma.pinterestOAuthState.deleteMany({ where: { stateHash } });
      throw new Error("Подключение отменено на Pinterest. Можно повторить его в настройках.");
    }
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) throw new Error("Pinterest не вернул код подключения.");
    const token = await requestToken(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: config.pinterestRedirectUri }));
    await saveConnection(saved.ownerTelegramId, token, stateHash);
    res.redirect(303, `${config.webAppUrl}/settings?pinterest=connected`);
  } catch (error) {
    res.clearCookie(COOKIE, cookieOptions);
    res.status(400).type("html").send(renderPinterestOAuthHtml({ title: "Pinterest не подключён",
      message: error instanceof Error ? error.message : "Не удалось подключить Pinterest. Повторите действие из настроек.", isError: true }));
  }
});
router.get("/boards", authRequired, admin, async (req, res, next) => {
  try {
    const bookmark = typeof req.query.bookmark === "string" ? req.query.bookmark : "";
    const data = await pinterestGet(`/boards?page_size=100${bookmark ? `&bookmark=${encodeURIComponent(bookmark)}` : ""}`);
    res.json({ items: (data.items || []).map((board: any) => ({ id: board.id, name: board.name })), bookmark: data.bookmark || null });
  } catch (error) { next(error); }
});
router.put("/board", authRequired, admin, async (req, res, next) => {
  try {
    const id = String(req.body.boardId || "");
    if (!/^\d+$/.test(id)) return res.status(400).json({ message: "Выберите доску Pinterest" });
    const board = await pinterestGet(`/boards/${encodeURIComponent(id)}`);
    // A legacy environment token must first be replaced by the connected OAuth account.
    await prisma.pinterestConnection.update({ where: { id: CONNECTION_ID }, data: { boardId: id, boardName: String(board.name) } });
    res.json(await connectionStatus());
  } catch (error) { next(error); }
});
router.delete("/connection", authRequired, admin, async (req, res, next) => {
  try {
    const data = { ownerTelegramId: readTelegramId(req)!, accessTokenEncrypted: null, refreshTokenEncrypted: null,
      expiresAt: null, scope: null, boardId: null, boardName: null };
    await prisma.$transaction([
      prisma.pinterestConnection.upsert({ where: { id: CONNECTION_ID }, create: { id: CONNECTION_ID, ...data }, update: data }),
      prisma.pinterestOAuthState.deleteMany({})
    ]);
    res.json(await connectionStatus());
  } catch (error) { next(error); }
});
export default router;
