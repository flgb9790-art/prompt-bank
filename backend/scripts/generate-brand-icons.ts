import fs from "fs";
import path from "path";
import sharp from "sharp";

const root = path.resolve(__dirname, "../..");
const logoPath = path.join(root, "miniapp/public/brand-logo.svg");
const outDir = path.join(root, "miniapp/public");
const background = { r: 248, g: 249, b: 253, alpha: 1 };

async function writeSquareIcon(size: number, filename: string) {
  const buffer = await sharp(logoPath)
    .resize(Math.round(size * 0.78), Math.round(size * 0.81), {
      fit: "contain",
      background
    })
    .extend({
      top: Math.round(size * 0.1),
      bottom: Math.round(size * 0.09),
      left: Math.round(size * 0.11),
      right: Math.round(size * 0.11),
      background
    })
    .resize(size, size, { fit: "cover" })
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(outDir, filename), buffer);
}

async function writeFaviconSvg(png32: Buffer) {
  const base64 = png32.toString("base64");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <image width="32" height="32" href="data:image/png;base64,${base64}" />
</svg>`;
  fs.writeFileSync(path.join(outDir, "favicon.svg"), svg);
}

async function main() {
  if (!fs.existsSync(logoPath)) {
    throw new Error(`Logo not found: ${logoPath}`);
  }

  const png32 = await sharp(logoPath)
    .resize(25, 26, { fit: "contain", background })
    .extend({
      top: 3,
      bottom: 3,
      left: 4,
      right: 4,
      background
    })
    .resize(32, 32, { fit: "cover" })
    .png()
    .toBuffer();

  await writeFaviconSvg(png32);
  fs.writeFileSync(path.join(outDir, "favicon-32x32.png"), png32);
  await writeSquareIcon(180, "apple-touch-icon.png");
  await writeSquareIcon(192, "icon-192.png");
  await writeSquareIcon(512, "icon-512.png");

  console.log("Brand icons generated in miniapp/public/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
