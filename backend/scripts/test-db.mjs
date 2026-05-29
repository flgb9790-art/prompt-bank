import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const categories = await prisma.category.findMany();
  const prompt = await prisma.prompt.findFirst({
    include: {
      category: true,
      keywords: { include: { keyword: true } },
      examples: true
    }
  });
  console.log("OK", { categories: categories.length, promptId: prompt?.id });
} catch (error) {
  console.error("FAIL", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
