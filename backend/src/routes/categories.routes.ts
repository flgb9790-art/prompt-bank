import { Router } from "express";
import { prisma } from "../db";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { prompts: true } } }
    });

    res.set("Cache-Control", "public, max-age=300");
    res.json(
      categories.map(({ _count, ...category }) => ({
        ...category,
        promptCount: _count.prompts
      }))
    );
  } catch (error) {
    next(error);
  }
});

export default router;
