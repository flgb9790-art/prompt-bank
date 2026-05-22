import { Router } from "express";
import { prisma } from "../db";
import { readTelegramId, isAdminRequest } from "../auth";
import { resolveUserIdByTelegramId } from "../user";
import { PromptService } from "../services/prompt.service";

const router = Router();

async function optionalUserId(req: { header: (name: string) => string | undefined }) {
  const telegramId = readTelegramId(req as Parameters<typeof readTelegramId>[0]);
  if (!telegramId) return undefined;
  return resolveUserIdByTelegramId(telegramId);
}

router.get("/", async (req, res, next) => {
  try {
    const userId = await optionalUserId(req);
    const telegramId = readTelegramId(req);
    const promptLimit = Math.min(Number(req.query.promptLimit) || 25, 40);

    const [categoriesRaw, tagsRaw, me, prompts, favoritesResult] = await Promise.all([
      prisma.category.findMany({
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { prompts: true } } }
      }),
      prisma.keyword.findMany({
        include: { _count: { select: { prompts: true } } },
        orderBy: { name: "asc" },
        take: 120
      }),
      (async () => {
        if (!telegramId) {
          return { authenticated: false, isAdmin: false, user: null, usageTotal: 0 };
        }
        const user = await prisma.user.upsert({
          where: { telegramId },
          update: {},
          create: { telegramId }
        });
        const usageTotal = await PromptService.getUserUsageTotal(user.id);
        return {
          authenticated: true,
          isAdmin: isAdminRequest(req),
          user,
          usageTotal
        };
      })(),
      PromptService.list({
        limit: promptLimit,
        offset: 0,
        lite: true,
        sort: "new",
        userId,
        includeTotal: true
      }),
      userId
        ? PromptService.list({
            favorite: "true",
            limit: 40,
            lite: true,
            userId,
            includeTotal: false
          })
        : Promise.resolve(null)
    ]);

    res.set("Cache-Control", "private, no-store");
    res.json({
      categories: categoriesRaw.map(({ _count, ...category }) => ({
        ...category,
        promptCount: _count.prompts
      })),
      tags: tagsRaw.map((tag) => ({
        id: tag.id,
        name: tag.name,
        count: tag._count.prompts
      })),
      me,
      prompts,
      favorites: favoritesResult?.items ?? []
    });
  } catch (error) {
    next(error);
  }
});

export default router;
