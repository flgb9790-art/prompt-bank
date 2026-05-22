import { Router } from "express";
import { prisma } from "../db";
import { PromptService } from "../services/prompt.service";
import { authRequired, isAdminRequest, readTelegramId } from "../auth";
import { resolveUserIdByTelegramId } from "../user";

type MediaType = "image" | "video";

const router = Router();

async function optionalUserId(req: { header: (name: string) => string | undefined }) {
  const telegramId = readTelegramId(req as any);
  if (!telegramId) return undefined;
  return resolveUserIdByTelegramId(telegramId);
}

router.get("/", async (req, res, next) => {
  try {
    const userId = await optionalUserId(req);
    const result = await PromptService.list({
      search: req.query.search as string | undefined,
      category: req.query.category as string | undefined,
      tag: req.query.tag as string | undefined,
      sort: req.query.sort as string | undefined,
      favorite: req.query.favorite as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
      lite: req.query.lite === "1" || req.query.lite === "true",
      userId
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (!readTelegramId(req)) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }
    if (!isAdminRequest(req)) {
      return res.status(403).json({ message: "Only admin can create prompts" });
    }
    const requesterTelegramId = readTelegramId(req);
    let userId = Number(req.body.userId);

    if (requesterTelegramId) {
      userId = await resolveUserIdByTelegramId(requesterTelegramId);
    }

    if (!Number.isFinite(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const created = await PromptService.create({
      userId,
      title: String(req.body.title),
      content: String(req.body.content),
      categoryId: Number(req.body.categoryId),
      note: req.body.note ? String(req.body.note) : undefined,
      coverMediaUrl: req.body.coverMediaUrl ? String(req.body.coverMediaUrl) : undefined,
      coverMediaType: req.body.coverMediaType as MediaType | undefined,
      examples: Array.isArray(req.body.examples)
        ? req.body.examples.map((example: { url: string; type: MediaType; originalName?: string }) => ({
            url: example.url,
            type: example.type,
            originalName: example.originalName
          }))
        : []
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const userId = await optionalUserId(req);
    const prompt = await PromptService.getById(Number(req.params.id), userId);
    if (!prompt) {
      return res.status(404).json({ message: "Prompt not found" });
    }
    res.json(prompt);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!readTelegramId(req)) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }
    if (!isAdminRequest(req)) {
      return res.status(403).json({ message: "Only admin can edit prompts" });
    }
    const userId = await optionalUserId(req);
    const updated = await PromptService.update(Number(req.params.id), req.body);
    const withFavorite = await PromptService.getById(updated.id, userId);
    res.json(withFavorite ?? updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!readTelegramId(req)) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }
    if (!isAdminRequest(req)) {
      return res.status(403).json({ message: "Only admin can delete prompts" });
    }
    await PromptService.remove(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/:id/favorite", authRequired, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const telegramId = readTelegramId(req);
    if (!telegramId) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }
    const userId = await resolveUserIdByTelegramId(telegramId);
    const updated = await PromptService.toggleFavorite(id, userId);
    if (!updated) {
      return res.status(404).json({ message: "Prompt not found" });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/usage", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const userId = await optionalUserId(req);
    const updated = await PromptService.incrementUsage(id, userId);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/examples", authRequired, async (req, res, next) => {
  try {
    if (!isAdminRequest(req)) {
      return res.status(403).json({ message: "Only admin can add examples" });
    }
    const id = Number(req.params.id);
    const created = await prisma.mediaExample.create({
      data: {
        promptId: id,
        url: String(req.body.url),
        type: req.body.type as MediaType,
        originalName: req.body.originalName ? String(req.body.originalName) : undefined
      }
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.delete("/examples/:id", authRequired, async (req, res, next) => {
  try {
    if (!isAdminRequest(req)) {
      return res.status(403).json({ message: "Only admin can delete examples" });
    }
    await prisma.mediaExample.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
