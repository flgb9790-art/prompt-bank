import { writeFileSync } from "node:fs";
import { join } from "node:path";

const distDir = process.argv[2] || "dist";
const backendUrl = (
  process.env.VITE_BACKEND_URL ||
  process.env.BACKEND_URL ||
  process.env.RAILWAY_PUBLIC_BACKEND_URL ||
  ""
)
  .trim()
  .replace(/\/$/, "");

const mediaCdnUrl = (process.env.VITE_MEDIA_CDN_URL || process.env.MEDIA_PUBLIC_URL || backendUrl)
  .trim()
  .replace(/\/$/, "");

const config = {
  backendUrl: backendUrl || undefined,
  mediaCdnUrl: mediaCdnUrl || undefined
};

const outPath = join(distDir, "config.js");
writeFileSync(
  outPath,
  `window.__PROMPT_BANK_CONFIG__=${JSON.stringify(config)};\n`,
  "utf8"
);

console.log(`Wrote ${outPath}`, config);
