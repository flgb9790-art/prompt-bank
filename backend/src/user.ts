import { prisma } from "./db";

export async function resolveUserIdByTelegramId(telegramId: string): Promise<number> {
  const user = await prisma.user.upsert({
    where: { telegramId },
    update: {},
    create: { telegramId }
  });
  return user.id;
}
