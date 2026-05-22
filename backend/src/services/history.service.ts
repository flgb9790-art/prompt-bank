import { prisma } from "../db";
import { PromptService } from "./prompt.service";

const promptHistoryInclude = (userId: number) =>
  ({
    prompt: {
      include: {
        category: true,
        keywords: { include: { keyword: true } },
        examples: true,
        favorites: { where: { userId }, select: { id: true }, take: 1 }
      }
    }
  }) as const;

function normalizeSource(source?: string) {
  return source === "miniapp" ? "miniapp" : "web";
}

function mapHistoryPrompt(prompt: any) {
  if (!prompt) return null;
  const { keywords, favorites, ...rest } = prompt;
  return {
    ...rest,
    keywords: keywords ?? [],
    isFavorite: (favorites?.length ?? 0) > 0
  };
}

export class HistoryService {
  static async getUserSettings(userId: number) {
    return prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        saveViewHistory: true,
        saveCopyHistory: true,
        createdAt: true
      }
    });
  }

  static async updateUserSettings(
    userId: number,
    data: Partial<{ saveViewHistory: boolean; saveCopyHistory: boolean }>
  ) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.saveViewHistory !== undefined ? { saveViewHistory: data.saveViewHistory } : {}),
        ...(data.saveCopyHistory !== undefined ? { saveCopyHistory: data.saveCopyHistory } : {})
      },
      select: {
        saveViewHistory: true,
        saveCopyHistory: true,
        createdAt: true
      }
    });
  }

  static async recordView(userId: number, promptId: number, source?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.saveViewHistory) {
      return { recorded: false };
    }

    const prompt = await prisma.prompt.findUnique({ where: { id: promptId }, select: { id: true } });
    if (!prompt) {
      return { recorded: false, notFound: true };
    }

    await prisma.promptView.create({
      data: {
        userId,
        promptId,
        source: normalizeSource(source)
      }
    });

    return { recorded: true };
  }

  static async recordCopy(userId: number, promptId: number, source?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const prompt = await prisma.prompt.findUnique({ where: { id: promptId }, select: { id: true } });
    if (!prompt) {
      return { recorded: false, notFound: true };
    }

    await PromptService.incrementUsage(promptId, userId);

    if (!user?.saveCopyHistory) {
      return { recorded: false, usageUpdated: true };
    }

    await prisma.promptCopy.create({
      data: {
        userId,
        promptId,
        source: normalizeSource(source)
      }
    });

    return { recorded: true, usageUpdated: true };
  }

  static async getViewedPrompts(userId: number, limit = 30, offset = 0) {
    const [items, total] = await Promise.all([
      prisma.promptView.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: promptHistoryInclude(userId)
      }),
      prisma.promptView.count({ where: { userId } })
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        viewedAt: item.createdAt,
        source: item.source,
        prompt: mapHistoryPrompt(item.prompt)
      })),
      total
    };
  }

  static async getCopiedPrompts(userId: number, limit = 30, offset = 0) {
    const [items, total] = await Promise.all([
      prisma.promptCopy.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: promptHistoryInclude(userId)
      }),
      prisma.promptCopy.count({ where: { userId } })
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        copiedAt: item.createdAt,
        source: item.source,
        prompt: mapHistoryPrompt(item.prompt)
      })),
      total
    };
  }

  static async clearViewedPrompts(userId: number) {
    await prisma.promptView.deleteMany({ where: { userId } });
  }

  static async clearCopiedPrompts(userId: number) {
    await prisma.promptCopy.deleteMany({ where: { userId } });
  }

  static async getUserStats(userId: number) {
    const [favoritesCount, copiedCount, viewedCount, createdPromptsCount, usageAggregate] = await Promise.all([
      prisma.favorite.count({ where: { userId } }),
      prisma.promptCopy.count({ where: { userId } }),
      prisma.promptView.count({ where: { userId } }),
      prisma.prompt.count({ where: { userId } }),
      PromptService.getUserUsageTotal(userId)
    ]);

    return {
      favoritesCount,
      copiedCount,
      viewedCount,
      createdPromptsCount,
      usageCountTotal: usageAggregate
    };
  }
}
