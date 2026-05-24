import fs from "fs";
import path from "path";
import { execSync } from "child_process";
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
  "PromptUsage",
  "PromptView",
  "PromptCopy",
  "TelegramPublication",
  "PinterestPublication"
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

  for (const table of [
    "User",
    "Category",
    "Keyword",
    "Prompt",
    "MediaExample",
    "Favorite",
    "PromptUsage",
    "TelegramPublication",
    "PinterestPublication"
  ]) {
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

function exportGitState(outDir: string) {
  const repoDir = path.join(outDir, "repo");
  ensureDir(repoDir);

  const writeText = (name: string, command: string) => {
    try {
      const value = execSync(command, { cwd: path.resolve(process.cwd(), ".."), encoding: "utf8" }).trim();
      fs.writeFileSync(path.join(repoDir, name), `${value}\n`, "utf8");
    } catch {
      fs.writeFileSync(path.join(repoDir, name), "unknown\n", "utf8");
    }
  };

  writeText("git-commit.txt", "git rev-parse HEAD");
  writeText("git-branch.txt", "git rev-parse --abbrev-ref HEAD");
  writeText("git-remote.txt", "git remote get-url origin");
  writeText("git-log-head.txt", "git log -1 --format=%H%n%s%n%an%n%ae");

  try {
    const logHead = fs.readFileSync(path.join(repoDir, "git-log-head.txt"), "utf8").trim().split("\n");
    return {
      commit: logHead[0] ?? "unknown",
      branch: fs.readFileSync(path.join(repoDir, "git-branch.txt"), "utf8").trim(),
      remote: fs.readFileSync(path.join(repoDir, "git-remote.txt"), "utf8").trim(),
      message: logHead[1] ?? ""
    };
  } catch {
    return { commit: "unknown", branch: "unknown", remote: "unknown", message: "" };
  }
}

function exportRailwayConfig(outDir: string) {
  const configDir = path.join(outDir, "config");
  ensureDir(configDir);

  const services = [
    { file: "railway-prompt-bank.json", service: "prompt-bank" },
    { file: "railway-postgres.json", service: "Postgres" },
    { file: "railway-miniapp.json", service: "diplomatic-communication" }
  ];

  for (const item of services) {
    try {
      const json = execSync(`railway variables --json --service ${item.service}`, {
        cwd: path.resolve(process.cwd(), ".."),
        encoding: "utf8"
      });
      fs.writeFileSync(path.join(configDir, item.file), `${json.trim()}\n`, "utf8");
    } catch (error) {
      writeJson(path.join(configDir, item.file), {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

function copySchema(outDir: string) {
  const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
  const targetPath = path.join(outDir, "database", "schema.prisma");
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(schemaPath, targetPath);
}

function writeRestoreGuide(outDir: string, git: { commit: string; branch: string }) {
  const text = `Prompt Bank — full backup
Created: ${new Date().toISOString()}
Git commit: ${git.commit.slice(0, 7)} (${git.branch})

WHAT IS INSIDE
- database/          JSON per table + restore.sql + schema.prisma
- media/images/      originals + thumbs (webp)
- config/            Railway env vars (prompt-bank, Postgres, miniapp) — SECRET
- repo/              git commit + last commit metadata
- manifest.json      summary counts

RESTORE DATABASE
1. Create/use Railway Postgres (or local Postgres).
2. Run schema: npx prisma db push (from repo at commit ${git.commit.slice(0, 7)}).
3. Apply data: psql "$DATABASE_URL" -f database/restore.sql

RESTORE MEDIA
1. Mount Railway volume at /data/uploads on prompt-bank service.
2. Copy media/images/* -> /data/uploads/images/
3. Copy media/images/thumbs/* -> /data/uploads/images/thumbs/
4. Set UPLOADS_DIR=/data/uploads and MEDIA_PUBLIC_URL=https://prompt-bank-production.up.railway.app

RESTORE RAILWAY CONFIG
1. Recreate variables from config/railway-*.json in Railway dashboard/CLI.
2. Redeploy prompt-bank and diplomatic-communication services.

RE-RUN BACKUP LATER
cd backend
set DATABASE_URL=<Railway DATABASE_PUBLIC_URL>
set BACKEND_URL=https://prompt-bank-production.up.railway.app
npm run backup:full

SECURITY
This folder contains BOT_TOKEN, DB passwords, and other secrets.
Do not commit to git. Store offline or in encrypted storage only.
`;

  fs.writeFileSync(path.join(outDir, "RESTORE.txt"), text, "utf8");
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

  copySchema(BACKUP_ROOT);
  const git = exportGitState(BACKUP_ROOT);
  exportRailwayConfig(BACKUP_ROOT);
  writeRestoreGuide(BACKUP_ROOT, git);

  const manifest = {
    createdAt: new Date().toISOString(),
    project: "prompt-bank-telegram-miniapp",
    backendUrl: BACKEND_URL,
    miniappUrl: "https://diplomatic-communication-production-6b54.up.railway.app",
    railwayProject: "exemplary-emotion",
    git,
    database: counts,
    media: {
      downloaded: media.downloaded.length,
      failed: media.failed
    },
    paths: {
      database: "database/*.json, database/restore.sql, database/schema.prisma",
      media: "media/images/",
      config: "config/railway-prompt-bank.json, config/railway-postgres.json, config/railway-miniapp.json",
      repo: "repo/git-commit.txt, repo/git-log-head.txt",
      restoreGuide: "RESTORE.txt"
    }
  };

  writeJson(path.join(BACKUP_ROOT, "manifest.json"), manifest);
  console.log("Backup complete.");
  console.log(`Archive folder: ${BACKUP_ROOT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
