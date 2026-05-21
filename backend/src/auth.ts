import type { NextFunction, Request, Response } from "express";
import { config } from "./config";

export function readTelegramId(req: Request): string | null {
  const header = req.header("x-telegram-id");
  if (!header) return null;
  const value = header.trim();
  return value.length ? value : null;
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
