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
  isFavorite?: boolean;
  coverMediaUrl?: string | null;
  coverMediaType?: MediaType | null;
};

const promptInclude = {
  category: true,
  keywords: { include: { keyword: true } },
  examples: true
} as const;

export class PromptService {
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

    if (params.favorite !== undefined) {
      where.isFavorite = params.favorite === "true";
    }

    const includeExamples = params.lite !== true;

    return prisma.prompt.findMany({
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
  }

  static async getById(id: number) {
    return prisma.prompt.findUnique({
      where: { id },
      include: {
        ...promptInclude,
        user: true
      }
    });
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

    return prisma.prompt.findUniqueOrThrow({
      where: { id: prompt.id },
      include: promptInclude
    });
  }

  static async update(id: number, input: PromptUpdateInput) {
    const keywords = input.content ? extractKeywords(input.content, input.title) : null;

    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.content !== undefined) data.content = input.content;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.note !== undefined) data.note = input.note;
    if (input.isFavorite !== undefined) data.isFavorite = input.isFavorite;
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

    return prisma.prompt.findUniqueOrThrow({
      where: { id },
      include: promptInclude
    });
  }

  static async remove(id: number) {
    return prisma.prompt.delete({ where: { id } });
  }
}
