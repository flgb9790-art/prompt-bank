import { Router, type Request, type Response } from "express";
import multer from "multer";
import { isAdminRequest, readTelegramId } from "../auth";
import { StudioError } from "../services/ideaStudio.validation";
import {
  allowStudioPublicationRetry,
  editStudioDraft,
  enqueueStudioBatch,
  enqueueStudioDraftAction,
  enqueueStudioPublication,
  getStudioOverview,
  kickStudioWorker,
  saveStudioSettings,
  setStudioReference,
  getStudioReference,
} from "../services/ideaStudio.service";

const router = Router();
router.use((req, res, next) => {
  if (!readTelegramId(req))
    return res.status(401).json({ error: "AUTH_REQUIRED" });
  if (!isAdminRequest(req))
    return res
      .status(403)
      .json({ message: "Студия доступна только администратору." });
  next();
});
function handle(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (error) {
      res.status(error instanceof StudioError ? error.status : 500).json({
        message:
          error instanceof StudioError
            ? error.message
            : "Не удалось выполнить действие в студии. Попробуйте обновить страницу.",
      });
    }
  };
}
router.get(
  "/",
  handle(async (req, res) => {
    res.json(
      await getStudioOverview(
        typeof req.query.batchId === "string" ? req.query.batchId : undefined,
      ),
    );
  }),
);
const referenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
      return cb(new StudioError("Используйте фото JPG, PNG или WebP."));
    cb(null, true);
  },
});
router.post(
  "/reference",
  referenceUpload.single("file"),
  handle(async (req, res) => {
    if (!req.file) throw new StudioError("Выберите фото персонажа.");
    await setStudioReference(req.file.buffer);
    res.status(201).json({ ok: true });
  }),
);
router.delete(
  "/reference",
  handle(async (_req, res) => {
    await setStudioReference(null);
    res.json({ ok: true });
  }),
);
router.get(
  "/reference",
  handle(async (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.type("jpeg").send(await getStudioReference());
  }),
);
router.get(
  "/batches/:id/reference",
  handle(async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.type("jpeg").send(await getStudioReference(req.params.id));
  }),
);
router.put(
  "/settings",
  handle(async (req, res) => {
    await saveStudioSettings(req.body, readTelegramId(req)!);
    res.json({ ok: true });
  }),
);
router.post(
  "/batches",
  handle(async (req, res) => {
    if (
      req.body.useWebSearch !== undefined &&
      typeof req.body.useWebSearch !== "boolean"
    )
      throw new StudioError("Неверная настройка поиска.");
    const batch = await enqueueStudioBatch(req.body, readTelegramId(req)!);
    res.status(202).json({ batchId: batch.id });
    kickStudioWorker();
  }),
);
router.patch(
  "/drafts/:id",
  handle(async (req, res) => {
    await editStudioDraft(req.params.id, req.body);
    res.json({ ok: true });
  }),
);
for (const kind of ["image", "rewrite"] as const) {
  router.post(
    `/drafts/:id/${kind}`,
    handle(async (req, res) => {
      const job = await enqueueStudioDraftAction(
        req.params.id,
        kind,
        readTelegramId(req)!,
        req.body.instructions,
      );
      res.status(202).json({ jobId: job.id });
      kickStudioWorker();
    }),
  );
}
router.post(
  "/publish",
  handle(async (req, res) => {
    const job = await enqueueStudioPublication(
      req.body.draftIds,
      readTelegramId(req)!,
      req.body.confirmed,
    );
    res.status(202).json({ jobId: job.id });
    kickStudioWorker();
  }),
);
router.post(
  "/drafts/:id/allow-telegram-retry",
  handle(async (req, res) => {
    await allowStudioPublicationRetry(req.params.id, req.body.confirmed);
    res.json({ ok: true });
  }),
);
router.use((error: Error, _req: Request, res: Response, _next: unknown) => {
  res
    .status(
      error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? 413
        : 400,
    )
    .json({
      message:
        error instanceof multer.MulterError
          ? "Фото должно быть не больше 10 МБ. Загружайте один файл."
          : error instanceof StudioError
            ? error.message
            : "Не удалось загрузить фото.",
    });
});
export default router;
