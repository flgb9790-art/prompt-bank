import { prisma } from "../db";
import { extractKeywords } from "../keywordExtractor";

type MediaType = "image" | "video";

type PromptCreateInput = {
  userId: number;
  title: string;
  content: string;
  categoryId: number;
  note?: string;
  coverMediaUrl?: string;
  coverMediaType?: MediaType;
  examples?: Array<{ url: string; type: MediaType; originalName?: string }>;
};

type PromptUpdateInput = Partial<Omit<PromptCreateInput, "userId" | "examples">> & {
  coverMediaUrl?: string | null;
  coverMediaType?: MediaType | null;
};

const promptInclude = {
  category: true,
  keywords: { include: { keyword: true } },
  examples: true
} as const;

export class PromptService {
  private static async favoritePromptIds(userId?: number): Promise<Set<number>> {
    if (!userId) return new Set();
    const rows = await prisma.favorite.findMany({
      where: { userId },
      select: { promptId: true }
    });
    return new Set(rows.map((row) => row.promptId));
  }

  private static withFavorite<T extends { id: number }>(prompt: T, favoriteIds: Set<number>) {
    return {
      ...prompt,
      isFavorite: favoriteIds.has(prompt.id)
    };
  }

  private static async attachKeywords(promptId: number, keywordNames: string[]) {
    if (!keywordNames.length) return;

    const keywords = await Promise.all(
      keywordNames.map((name) =>
        prisma.keyword.upsert({
          where: { name },
          update: {},
          create: { name }
        })
      )
    );

    await prisma.promptKeyword.createMany({
      data: keywords.map((keyword) => ({ promptId, keywordId: keyword.id })),
      skipDuplicates: true
    });
  }

  static async list(params: {
    search?: string;
    category?: string;
    favorite?: string;
    limit?: number;
    offset?: number;
    lite?: boolean;
    userId?: number;
  }) {
    const where: any = {};

    if (params.search) {
      where.OR = [
        { title: { contains: params.search } },
        { content: { contains: params.search } },
        { keywords: { some: { keyword: { name: { contains: params.search } } } } },
        { category: { name: { contains: params.search } } }
      ];
    }

    if (params.category) {
      where.category = { slug: params.category };
    }

    if (params.favorite === "true" && params.userId) {
      where.favorites = { some: { userId: params.userId } };
    }

    const includeExamples = params.lite !== true;
    const favoriteIds = await PromptService.favoritePromptIds(params.userId);

    const prompts = await prisma.prompt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: params.offset ?? 0,
      take: params.limit ?? 30,
      include: {
        category: true,
        keywords: { include: { keyword: true } },
        ...(includeExamples ? { examples: true } : {})
      }
    });

    return prompts.map((prompt) => PromptService.withFavorite(prompt, favoriteIds));
  }

  static async getById(id: number, userId?: number) {
    const favoriteIds = await PromptService.favoritePromptIds(userId);
    const prompt = await prisma.prompt.findUnique({
      where: { id },
      include: {
        ...promptInclude,
        user: true
      }
    });
    if (!prompt) return null;
    return PromptService.withFavorite(prompt, favoriteIds);
  }

  static async create(input: PromptCreateInput) {
    const keywords = extractKeywords(input.content, input.title);

    const prompt = await prisma.prompt.create({
      data: {
        userId: input.userId,
        title: input.title,
        content: input.content,
        categoryId: input.categoryId,
        note: input.note,
        coverMediaType: input.coverMediaType,
        coverMediaUrl: input.coverMediaUrl,
        examples: input.examples?.length
          ? {
              create: input.examples.map((example) => ({
                url: example.url,
                type: example.type,
                originalName: example.originalName
              }))
            }
          : undefined
      }
    });

    await PromptService.attachKeywords(prompt.id, keywords);

    const created = await prisma.prompt.findUniqueOrThrow({
      where: { id: prompt.id },
      include: promptInclude
    });
    return { ...created, isFavorite: false };
  }

  static async update(id: number, input: PromptUpdateInput) {
    const keywords = input.content ? extractKeywords(input.content, input.title) : null;

    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.content !== undefined) data.content = input.content;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.note !== undefined) data.note = input.note;
    if (input.coverMediaUrl !== undefined) data.coverMediaUrl = input.coverMediaUrl;
    if (input.coverMediaType !== undefined) data.coverMediaType = input.coverMediaType;

    await prisma.prompt.update({
      where: { id },
      data
    });

    if (keywords) {
      await prisma.promptKeyword.deleteMany({ where: { promptId: id } });
      await PromptService.attachKeywords(id, keywords);
    }

    const updated = await prisma.prompt.findUniqueOrThrow({
      where: { id },
      include: promptInclude
    });
    return { ...updated, isFavorite: false };
  }

  static async remove(id: number) {
    return prisma.prompt.delete({ where: { id } });
  }

  static async toggleFavorite(promptId: number, userId: number) {
    const prompt = await prisma.prompt.findUnique({ where: { id: promptId } });
    if (!prompt) {
      return null;
    }

    const existing = await prisma.favorite.findUnique({
      where: {
        userId_promptId: {
          userId,
          promptId
        }
      }
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
    } else {
      await prisma.favorite.create({
        data: { userId, promptId }
      });
    }

    return PromptService.getById(promptId, userId);
  }

  static async incrementUsage(id: number, userId?: number) {
    await prisma.prompt.update({
      where: { id },
      data: { usageCount: { increment: 1 } }
    });

    if (userId) {
      await prisma.promptUsage.upsert({
        where: {
          userId_promptId: {
            userId,
            promptId: id
          }
        },
        update: { count: { increment: 1 } },
        create: {
          userId,
          promptId: id,
          count: 1
        }
      });
    }

    return PromptService.getById(id, userId);
  }

  static async getUserUsageTotal(userId: number) {
    const aggregate = await prisma.promptUsage.aggregate({
      where: { userId },
      _sum: { count: true }
    });
    return aggregate._sum.count ?? 0;
  }
}
