import { Router } from "express";
import { prisma } from "../db";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const tags = await prisma.keyword.findMany({
      include: {
        _count: { select: { prompts: true } }
      },
      orderBy: { name: "asc" }
    });

    res.set("Cache-Control", "public, max-age=120");
    res.json(
      tags.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        count: tag._count.prompts
      }))
    );
  } catch (error) {
    next(error);
  }
});

export default router;
