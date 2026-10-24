import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { ensureLocalThumbnail } from "../src/services/localThumbnail.service";

test("missing previews are generated once, cached and much smaller than originals", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "prompt-bank-thumbs-"));
  try {
    await fs.mkdir(path.join(root, "images"));
    const pixels = Buffer.alloc(1600 * 2000 * 3);
    let seed = 42;
    for (let i = 0; i < pixels.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; pixels[i] = seed >>> 24; }
    const original = await sharp(pixels, { raw: { width: 1600, height: 2000, channels: 3 } }).png().toBuffer();
    const source = path.join(root, "images", "sample.png");
    await fs.writeFile(source, original);
    const results = await Promise.all(Array.from({ length: 8 }, () => ensureLocalThumbnail(root, "sample.webp")));
    assert.ok(results[0]);
    assert.ok(results.every((result) => result === results[0]));
    const output = await fs.readFile(results[0]!);
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, "webp"); assert.equal(metadata.width, 480); assert.equal(metadata.height, 600);
    assert.ok(output.length < original.length / 10, "Preview should be at least 10 times smaller than this large PNG");
    assert.deepEqual(await fs.readFile(source), original, "The original must remain intact");
    const before = await fs.stat(results[0]!);
    await ensureLocalThumbnail(root, "sample.webp");
    assert.equal((await fs.stat(results[0]!)).mtimeMs, before.mtimeMs);
    assert.deepEqual((await fs.readdir(path.dirname(results[0]!))).sort(), ["sample.webp"]);
    console.log(`Synthetic image: ${original.length} bytes → ${output.length} bytes (${Math.round(original.length / output.length)}x smaller)`);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test("invalid paths, absent originals and unreadable images do not create previews", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "prompt-bank-thumbs-invalid-"));
  try {
    await fs.mkdir(path.join(root, "images"));
    await fs.writeFile(path.join(root, "images", "broken.png"), "not an image");
    for (const name of ["../escape.webp", "a/b.webp", "sample.jpg", "..webp", "missing.webp", "broken.webp"]) {
      assert.equal(await ensureLocalThumbnail(root, name), null);
    }
    assert.equal((await fs.readdir(root)).includes("escape.webp"), false);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
