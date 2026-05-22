import { Router } from "express";
import { prisma } from "../db";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const [categories, grouped] = await Promise.all([
      prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.prompt.groupBy({
        by: ["categoryId"],
        _count: { _all: true }
      })
    ]);

    const countByCategoryId = new Map(grouped.map((row) => [row.categoryId, row._count._all]));

    res.set("Cache-Control", "public, max-age=300");
    res.json(
      categories.map((category) => ({
        ...category,
        promptCount: countByCategoryId.get(category.id) ?? 0
      }))
    );
  } catch (error) {
    next(error);
  }
});

export default router;
