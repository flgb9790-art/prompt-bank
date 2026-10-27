import { Router } from "express";
import { isAdminRequest, readTelegramId } from "../auth";
import { PromptService } from "../services/prompt.service";
import { sendPromptToTelegram } from "../services/telegramPublisher.service";
import { sendPromptToPinterest, previewPinterestPublication } from "../services/pinterestPublisher.service";
import { prisma } from "../db";
import { parseTelegramPostLink } from "../utils/telegramPostLink";

const router = Router();

router.get("/prompts/:id/pinterest-preview", async (req, res, next) => {
  try {
    if (!readTelegramId(req)) return res.status(401).json({ error: "AUTH_REQUIRED" });
    if (!isAdminRequest(req)) return res.status(403).json({ message: "Только администратор может публиковать пины" });
    const promptId = Number(req.params.id);
    if (!Number.isSafeInteger(promptId) || promptId <= 0) return res.status(400).json({ message: "Invalid prompt id" });
    res.json(await previewPinterestPublication(promptId));
  } catch (error) { next(error); }
});

router.patch("/prompts/:id/telegram-post-link", async (req, res, next) => {
  try {
    if (!readTelegramId(req)) return res.status(401).json({ error: "AUTH_REQUIRED" });
    if (!isAdminRequest(req)) return res.status(403).json({ message: "Только администратор может изменить ссылку" });
    const promptId = Number(req.params.id);
    if (!Number.isSafeInteger(promptId) || promptId <= 0) return res.status(400).json({ message: "Invalid prompt id" });
    let post;
    try { post = parseTelegramPostLink(req.body.telegramPostUrl); }
    catch (error) { return res.status(400).json({ message: (error as Error).message }); }
    if (!await prisma.prompt.findUnique({ where: { id: promptId } })) return res.status(404).json({ message: "Prompt not found" });
    await prisma.prompt.update({ where: { id: promptId }, data: {
      telegramPostUrl: post.url, telegramMessageId: post.messageId,
      telegramChatId: post.chatId, telegramPublished: true
    } });
    PromptService.invalidateDetailCache(promptId);
    res.json(await PromptService.getById(promptId));
  } catch (error) { next(error); }
});

router.post("/prompts/:id/publish-telegram", async (req, res, next) => {
  try {
    if (!readTelegramId(req)) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }
    if (!isAdminRequest(req)) {
      return res.status(403).json({ message: "Only admin can publish to Telegram" });
    }

    const promptId = Number(req.params.id);
    if (!Number.isFinite(promptId)) {
      return res.status(400).json({ message: "Invalid prompt id" });
    }

    const prompt = await PromptService.getById(promptId);
    if (!prompt) {
      return res.status(404).json({ message: "Prompt not found" });
    }

    const result = await sendPromptToTelegram(promptId);
    res.json({
      status: result.status,
      error: result.status === "failed" ? result.error : undefined,
      telegramPublication: result.publication
    });
  } catch (error) {
    next(error);
  }
});

router.post("/prompts/:id/publish-pinterest", async (req, res, next) => {
  try {
    if (!readTelegramId(req)) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }
    if (!isAdminRequest(req)) {
      return res.status(403).json({ message: "Only admin can publish to Pinterest" });
    }

    const promptId = Number(req.params.id);
    if (!Number.isFinite(promptId)) {
      return res.status(400).json({ message: "Invalid prompt id" });
    }

    const prompt = await PromptService.getById(promptId);
    if (!prompt) {
      return res.status(404).json({ message: "Prompt not found" });
    }

    const result = await sendPromptToPinterest(promptId, undefined, req.body?.destinationLink, req.body?.boardId);
    res.json({
      status: result.status,
      error: result.status === "failed" ? result.error : undefined,
      pinterestPublication: result.publication
    });
  } catch (error) {
    next(error);
  }
});

export default router;
