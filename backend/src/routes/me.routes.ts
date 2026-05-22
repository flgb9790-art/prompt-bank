import { Router } from "express";
import { authRequired, isAdminRequest, readTelegramId } from "../auth";
import { HistoryService } from "../services/history.service";
import { resolveUserIdByTelegramId } from "../user";
import { prisma } from "../db";
import { PromptService } from "../services/prompt.service";

const router = Router();

async function currentUserId(req: { header: (name: string) => string | undefined }) {
  const telegramId = readTelegramId(req as any);
  if (!telegramId) return null;
  return resolveUserIdByTelegramId(telegramId);
}

router.get("/stats", authRequired, async (req, res, next) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }
    const stats = await HistoryService.getUserStats(userId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.get("/viewed-prompts", authRequired, async (req, res, next) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const result = await HistoryService.getViewedPrompts(userId, limit, offset);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/copied-prompts", authRequired, async (req, res, next) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const result = await HistoryService.getCopiedPrompts(userId, limit, offset);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.delete("/viewed-prompts", authRequired, async (req, res, next) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }
    await HistoryService.clearViewedPrompts(userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.delete("/copied-prompts", authRequired, async (req, res, next) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }
    await HistoryService.clearCopiedPrompts(userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.patch("/settings", authRequired, async (req, res, next) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }
    const settings = await HistoryService.updateUserSettings(userId, {
      saveViewHistory:
        req.body.saveViewHistory === undefined ? undefined : Boolean(req.body.saveViewHistory),
      saveCopyHistory:
        req.body.saveCopyHistory === undefined ? undefined : Boolean(req.body.saveCopyHistory)
    });
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const telegramId = readTelegramId(req);
    if (!telegramId) {
      return res.json({ authenticated: false, isAdmin: false, user: null });
    }
    const user = await prisma.user.upsert({
      where: { telegramId },
      update: {},
      create: { telegramId }
    });
    const [usageTotal, stats, settings] = await Promise.all([
      PromptService.getUserUsageTotal(user.id),
      HistoryService.getUserStats(user.id),
      HistoryService.getUserSettings(user.id)
    ]);

    return res.json({
      authenticated: true,
      isAdmin: isAdminRequest(req),
      user,
      usageTotal,
      stats,
      settings
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
