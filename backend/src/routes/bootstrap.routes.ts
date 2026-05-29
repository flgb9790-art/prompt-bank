import { Router } from "express";
import { prisma } from "../db";
import { readTelegramId, isAdminRequest } from "../auth";
import { PromptService } from "../services/prompt.service";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const telegramId = readTelegramId(req);
    const promptLimit = Math.min(Number(req.query.promptLimit) || 12, 20);

    let userId: number | undefined;
    let me: {
      authenticated: boolean;
      isAdmin: boolean;
      user: { id: number; telegramId: string } | null;
      usageTotal: number;
    } = {
      authenticated: false,
      isAdmin: false,
      user: null,
      usageTotal: 0
    };

    const categoriesPromise = prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { prompts: true } } }
    });
    const userPromise = telegramId
      ? prisma.user.upsert({
          where: { telegramId },
          update: {},
          create: { telegramId }
        })
      : Promise.resolve(null);

    const [user, categoriesRaw] = await Promise.all([userPromise, categoriesPromise]);

    if (user) {
      userId = user.id;
      me = {
        authenticated: true,
        isAdmin: isAdminRequest(req),
        user,
        usageTotal: 0
      };
    }

    const prompts = await PromptService.list({
      limit: promptLimit,
      offset: 0,
      lite: true,
      sort: "new",
      userId,
      includeTotal: true
    });

    res.set("Cache-Control", "private, no-store");
    res.json({
      categories: categoriesRaw.map(({ _count, ...category }) => ({
        ...category,
        promptCount: _count.prompts
      })),
      tags: [],
      me,
      prompts,
      favorites: []
    });
  } catch (error) {
    next(error);
  }
});

export default router;
