import { Router } from "express";
import multer from "multer";
import path from "path";
import { getMediaKindByMime, resolveUploadPath } from "../services/media.service";

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const kind = getMediaKindByMime(file.mimetype);
    if (!kind) {
      return cb(new Error("Unsupported file type"), "");
    }
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${path.extname(file.originalname)}`;
    const resolved = resolveUploadPath(kind, filename);
    cb(null, path.dirname(resolved.diskPath));
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const kind = getMediaKindByMime(file.mimetype);
    if (!kind) {
      return cb(new Error("Only image/jpeg, image/png, image/webp, video/mp4, video/webm are allowed"));
    }
    cb(null, true);
  },
  limits: { fileSize: 40 * 1024 * 1024 }
});

router.post("/", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "File is required" });
    }
    const type = getMediaKindByMime(req.file.mimetype);
    if (!type) {
      return res.status(400).json({ message: "Unsupported file type" });
    }
    const folder = type === "image" ? "images" : "videos";
    res.status(201).json({
      url: `/uploads/${folder}/${req.file.filename}`,
      type,
      originalName: req.file.originalname
    });
  } catch (error) {
    next(error);
  }
});

export default router;
