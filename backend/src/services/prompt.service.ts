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

type PromptUpdateInput = Partial<Omit<PromptCreateInput, "userId">> & {
  isFavorite?: boolean;
};

export class PromptService {
  static async list(params: {
    search?: string;
    category?: string;
    favorite?: string;
    limit?: number;
    offset?: number;
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

    return prisma.prompt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: params.offset ?? 0,
      take: params.limit ?? 30,
      include: {
        category: true,
        keywords: { include: { keyword: true } },
        examples: true
      }
    });
  }

  static async getById(id: number) {
    return prisma.prompt.findUnique({
      where: { id },
      include: {
        category: true,
        keywords: { include: { keyword: true } },
        examples: true,
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

    for (const kw of keywords) {
      const keyword = await prisma.keyword.upsert({
        where: { name: kw },
        update: {},
        create: { name: kw }
      });
      await prisma.promptKeyword.upsert({
        where: { promptId_keywordId: { promptId: prompt.id, keywordId: keyword.id } },
        update: {},
        create: { promptId: prompt.id, keywordId: keyword.id }
      });
    }

    return prisma.prompt.findUniqueOrThrow({
      where: { id: prompt.id },
      include: {
        category: true,
        keywords: { include: { keyword: true } },
        examples: true
      }
    });
  }

  static async update(id: number, input: PromptUpdateInput) {
    const keywords = input.content ? extractKeywords(input.content, input.title) : null;

    await prisma.prompt.update({
      where: { id },
      data: {
        title: input.title,
        content: input.content,
        categoryId: input.categoryId,
        note: input.note,
        coverMediaUrl: input.coverMediaUrl,
        coverMediaType: input.coverMediaType,
        isFavorite: input.isFavorite
      }
    });

    if (keywords) {
      await prisma.promptKeyword.deleteMany({ where: { promptId: id } });
      for (const kw of keywords) {
        const keyword = await prisma.keyword.upsert({
          where: { name: kw },
          update: {},
          create: { name: kw }
        });
        await prisma.promptKeyword.create({
          data: { promptId: id, keywordId: keyword.id }
        });
      }
    }

    return prisma.prompt.findUniqueOrThrow({
      where: { id },
      include: {
        category: true,
        keywords: { include: { keyword: true } },
        examples: true
      }
    });
  }

  static async remove(id: number) {
    return prisma.prompt.delete({ where: { id } });
  }
}
