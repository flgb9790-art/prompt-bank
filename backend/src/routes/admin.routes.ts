import { Router } from "express";
import { isAdminRequest, readTelegramId } from "../auth";
import { PromptService } from "../services/prompt.service";
import { sendPromptToTelegram } from "../services/telegramPublisher.service";
import { sendPromptToPinterest } from "../services/pinterestPublisher.service";

const router = Router();

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

    const result = await sendPromptToPinterest(promptId);
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
