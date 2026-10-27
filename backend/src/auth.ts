import type { NextFunction, Request, Response } from "express";
import { config } from "./config";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE = 24 * 60 * 60;
function validSignature(fields: Record<string, string>, secret: Buffer): boolean {
  const { hash, ...data } = fields;
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return false;
  const age = Date.now() / 1000 - Number(data.auth_date);
  if (!Number.isFinite(age) || age < -60 || age > MAX_AGE) return false;
  const check = Object.keys(data).sort().map(key => `${key}=${data[key]}`).join("\n");
  return timingSafeEqual(Buffer.from(hash, "hex"), createHmac("sha256", secret).update(check).digest());
}

export function verifyTelegramIdentity(initData?: string, loginData?: string): string | null {
  const token = config.botToken || config.telegramBotToken;
  if (!token) return null;
  try {
    if (initData) {
      const params = new URLSearchParams(initData);
      if ([...params.keys()].some(key => params.getAll(key).length !== 1)) return null;
      const fields = Object.fromEntries(params);
      const secret = createHmac("sha256", "WebAppData").update(token).digest();
      if (!validSignature(fields, secret)) return null;
      const user = JSON.parse(fields.user);
      return Number.isSafeInteger(user.id) && user.id > 0 ? String(user.id) : null;
    }
    if (loginData) {
      const data = JSON.parse(decodeURIComponent(loginData));
      if (!data || typeof data !== "object" || Array.isArray(data)) return null;
      if (!Object.values(data).every(value => typeof value === "string" || typeof value === "number")) return null;
      const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)]));
      if (!validSignature(fields, createHash("sha256").update(token).digest())) return null;
      return /^\d+$/.test(fields.id) && Number.isSafeInteger(Number(fields.id)) && Number(fields.id) > 0 ? fields.id : null;
    }
  } catch { /* Invalid or forged Telegram payload. */ }
  return null;
}

export function readTelegramId(req: Request): string | null {
  return verifyTelegramIdentity(req.header("x-telegram-init-data"), req.header("x-telegram-login"));
}

export function isAuthenticatedRequest(req: Request): boolean {
  return Boolean(readTelegramId(req));
}

export function isAdminRequest(req: Request): boolean {
  const telegramId = readTelegramId(req);
  if (!telegramId) return false;
  return config.adminTelegramIds.includes(telegramId);
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ error: "AUTH_REQUIRED" });
  }
  return next();
}
