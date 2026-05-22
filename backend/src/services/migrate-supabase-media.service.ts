import fs from "fs";
import path from "path";
import { prisma } from "../db";
import { generateImageThumbnail, thumbFilenameFor } from "./thumbnail.service";

const UPLOADS_ROOT = process.env.UPLOADS_DIR?.trim()
  ? path.resolve(process.env.UPLOADS_DIR.trim())
  : path.resolve(process.cwd(), "src", "uploads");

function mediaPublicUrl() {
  return (
    process.env.MEDIA_PUBLIC_URL ??
    process.env.BACKEND_URL ??
    "https://prompt-bank-production.up.railway.app"
  ).replace(/\/$/, "");
}

function relativePathFromSupabaseUrl(url: string): string | null {
  const match = url.match(/\/uploads\/((?:images|videos)(?:\/thumbs)?\/[^?#]+)/i);
  return match?.[1] ?? null;
}

function publicUrlForRelativePath(relativePath: string) {
  return `${mediaPublicUrl()}/uploads/${relativePath.replace(/\\/g, "/")}`;
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function persistFile(relativePath: string, buffer: Buffer) {
  const diskPath = path.join(UPLOADS_ROOT, relativePath);
  fs.mkdirSync(path.dirname(diskPath), { recursive: true });
  if (!fs.existsSync(diskPath)) {
    fs.writeFileSync(diskPath, buffer);
  }
}

async function ensureThumbnail(relativePath: string, buffer: Buffer) {
  if (!relativePath.startsWith("images/") || relativePath.includes("/thumbs/")) {
    return;
  }
  const thumbName = thumbFilenameFor(path.basename(relativePath));
  const thumbRelative = `images/thumbs/${thumbName}`;
  const thumbPath = path.join(UPLOADS_ROOT, thumbRelative);
  if (fs.existsSync(thumbPath)) {
    return;
  }
  const thumbBuffer = await generateImageThumbnail(buffer);
  if (!thumbBuffer) {
    return;
  }
  await persistFile(thumbRelative, thumbBuffer);
}

async function migrateUrl(url: string): Promise<string> {
  if (!url.includes("supabase.co")) {
    return url;
  }
  const relativePath = relativePathFromSupabaseUrl(url);
  if (!relativePath) {
    console.warn(`Supabase media skip (unknown path): ${url}`);
    return url;
  }

  const buffer = await download(url);
  await persistFile(relativePath, buffer);
  await ensureThumbnail(relativePath, buffer);
  return publicUrlForRelativePath(relativePath);
}

export async function migrateSupabaseMedia() {
  const prompts = await prisma.prompt.findMany({
    where: { coverMediaUrl: { contains: "supabase.co" } },
    select: { id: true, coverMediaUrl: true }
  });
  const examples = await prisma.mediaExample.findMany({
    where: { url: { contains: "supabase.co" } },
    select: { id: true, url: true }
  });

  console.log(`Migrating media: ${prompts.length} covers, ${examples.length} examples`);

  for (const prompt of prompts) {
    if (!prompt.coverMediaUrl) continue;
    const nextUrl = await migrateUrl(prompt.coverMediaUrl);
    if (nextUrl !== prompt.coverMediaUrl) {
      await prisma.prompt.update({ where: { id: prompt.id }, data: { coverMediaUrl: nextUrl } });
      console.log(`  Prompt #${prompt.id}: migrated`);
    }
  }

  for (const example of examples) {
    const nextUrl = await migrateUrl(example.url);
    if (nextUrl !== example.url) {
      await prisma.mediaExample.update({ where: { id: example.id }, data: { url: nextUrl } });
      console.log(`  Example #${example.id}: migrated`);
    }
  }

  console.log("Supabase media migration finished.");
}
