import fs from "fs";
import path from "path";
import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL ?? process.env.DATABASE_PUBLIC_URL;
const BACKEND_URL = (process.env.BACKEND_URL ?? "https://prompt-bank-production.up.railway.app").replace(
  /\/$/,
  ""
);
const BACKUP_ROOT = process.env.BACKUP_DIR?.trim()
  ? path.resolve(process.env.BACKUP_DIR.trim())
  : path.resolve(process.cwd(), "..", "backups", `prompt-bank-full-${timestamp()}`);

const TABLES = [
  "User",
  "Category",
  "Keyword",
  "Prompt",
  "PromptKeyword",
  "MediaExample",
  "Favorite",
  "PromptUsage"
] as const;

function timestamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "_",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return `'${value.toISOString().replace("T", " ").replace("Z", "+00")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, data: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function exportDatabase(client: Client, outDir: string) {
  const databaseDir = path.join(outDir, "database");
  ensureDir(databaseDir);

  const tableData: Record<string, Record<string, unknown>[]> = {};
  const sqlLines: string[] = [
    "-- Prompt Bank PostgreSQL backup",
    `-- Generated: ${new Date().toISOString()}`,
    "BEGIN;",
    `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
    ""
  ];

  for (const table of TABLES) {
    const { rows } = await client.query(`SELECT * FROM "${table}" ORDER BY 1`);
    tableData[table] = rows;
    writeJson(path.join(databaseDir, `${table}.json`), rows);
    sqlLines.push(`TRUNCATE "${table}" CASCADE;`);
  }

  sqlLines.push("");
  for (const table of TABLES) {
    const rows = tableData[table];
    if (rows.length === 0) continue;
    const columns = Object.keys(rows[0]).map((name) => `"${name}"`).join(", ");
    for (const row of rows) {
      const values = Object.values(row).map(sqlLiteral).join(", ");
      sqlLines.push(`INSERT INTO "${table}" (${columns}) VALUES (${values});`);
    }
    sqlLines.push("");
  }

  for (const table of ["User", "Category", "Keyword", "Prompt", "MediaExample", "Favorite", "PromptUsage"]) {
    sqlLines.push(`
SELECT setval(
  pg_get_serial_sequence('"${table}"', 'id'),
  COALESCE((SELECT MAX(id) FROM "${table}"), 1),
  (SELECT MAX(id) IS NOT NULL FROM "${table}")
);`.trim());
  }

  sqlLines.push("COMMIT;");
  fs.writeFileSync(path.join(databaseDir, "restore.sql"), `${sqlLines.join("\n")}\n`, "utf8");

  const counts = Object.fromEntries(TABLES.map((table) => [table, tableData[table].length]));
  return counts;
}

function relativeUploadPath(url: string): string | null {
  if (!url) return null;
  if (url.startsWith("/uploads/")) return url.slice("/uploads/".length);
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/uploads\/(.+)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function downloadMedia(client: Client, outDir: string) {
  const mediaDir = path.join(outDir, "media");
  ensureDir(mediaDir);

  const { rows: promptRows } = await client.query<{ coverMediaUrl: string | null }>(
    `SELECT "coverMediaUrl" FROM "Prompt" WHERE "coverMediaUrl" IS NOT NULL`
  );
  const { rows: exampleRows } = await client.query<{ url: string }>(`SELECT url FROM "MediaExample"`);
  const urls = new Set<string>();

  for (const row of promptRows) {
    if (row.coverMediaUrl) urls.add(row.coverMediaUrl);
  }
  for (const row of exampleRows) {
    if (row.url) urls.add(row.url);
  }

  const downloaded: string[] = [];
  const failed: Array<{ url: string; error: string }> = [];

  for (const url of urls) {
    const relative = relativeUploadPath(url);
    if (!relative) continue;

    const targetPath = path.join(mediaDir, relative.replace(/\//g, path.sep));
    ensureDir(path.dirname(targetPath));

    const sourceUrl = url.startsWith("http") ? url : `${BACKEND_URL}/uploads/${relative}`;
    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        failed.push({ url: sourceUrl, error: `HTTP ${response.status}` });
        continue;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(targetPath, buffer);
      downloaded.push(relative);
    } catch (error) {
      failed.push({ url: sourceUrl, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const knownThumbs = downloaded
    .filter((item) => item.startsWith("images/") && !item.includes("/thumbs/"))
    .map((item) => {
      const base = path.parse(path.basename(item)).name;
      return `images/thumbs/${base}.webp`;
    });

  for (const relative of knownThumbs) {
    const targetPath = path.join(mediaDir, relative.replace(/\//g, path.sep));
    if (fs.existsSync(targetPath)) continue;
    ensureDir(path.dirname(targetPath));
    const sourceUrl = `${BACKEND_URL}/uploads/${relative}`;
    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(targetPath, buffer);
      downloaded.push(relative);
    } catch {
      // thumbs are optional
    }
  }

  return { downloaded, failed };
}

async function main() {
  if (!DATABASE_URL) {
    console.error("Set DATABASE_URL or DATABASE_PUBLIC_URL");
    process.exit(1);
  }

  ensureDir(BACKUP_ROOT);
  console.log(`Backup directory: ${BACKUP_ROOT}`);

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const counts = await exportDatabase(client, BACKUP_ROOT);
  console.log("Database exported:", counts);

  const media = await downloadMedia(client, BACKUP_ROOT);
  console.log(`Media downloaded: ${media.downloaded.length}`);
  if (media.failed.length > 0) {
    console.warn("Media failures:", media.failed);
  }

  await client.end();

  const manifest = {
    createdAt: new Date().toISOString(),
    project: "prompt-bank-telegram-miniapp",
    backendUrl: BACKEND_URL,
    database: counts,
    media: {
      downloaded: media.downloaded.length,
      failed: media.failed
    },
    contents: {
      database: "database/*.json + database/restore.sql",
      media: "media/uploads mirror",
      config: "config/railway-*.json (create separately via Railway CLI)",
      repo: "repo/git-state.json"
    }
  };

  writeJson(path.join(BACKUP_ROOT, "manifest.json"), manifest);
  console.log("Backup complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
