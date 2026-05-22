import { Client } from "pg";

const SOURCE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_URL = process.env.TARGET_DATABASE_URL;

if (!SOURCE_URL || !TARGET_URL) {
  console.error("Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL");
  process.exit(1);
}

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

async function copyTable(source: Client, target: Client, table: (typeof TABLES)[number]) {
  const { rows } = await source.query(`SELECT * FROM "${table}"`);
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows (skip)`);
    return;
  }

  const columns = Object.keys(rows[0]);
  const colList = columns.map((c) => `"${c}"`).join(", ");
  const chunkSize = 100;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values: unknown[] = [];
    const placeholders = chunk
      .map((row, rowIndex) => {
        const base = rowIndex * columns.length;
        columns.forEach((col) => values.push(row[col]));
        const ph = columns.map((_, colIndex) => `$${base + colIndex + 1}`).join(", ");
        return `(${ph})`;
      })
      .join(", ");

    await target.query(`INSERT INTO "${table}" (${colList}) VALUES ${placeholders}`, values);
  }

  console.log(`  ${table}: ${rows.length} rows`);
}

async function resetSequences(target: Client) {
  for (const table of ["User", "Category", "Keyword", "Prompt", "MediaExample", "Favorite", "PromptUsage"]) {
    await target.query(`
      SELECT setval(
        pg_get_serial_sequence('"${table}"', 'id'),
        COALESCE((SELECT MAX(id) FROM "${table}"), 1),
        (SELECT MAX(id) IS NOT NULL FROM "${table}")
      )
    `);
  }
}

async function main() {
  const source = new Client({
    connectionString: SOURCE_URL.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?$/, ""),
    ssl: { rejectUnauthorized: false }
  });
  const target = new Client({ connectionString: TARGET_URL });

  await source.connect();
  await target.connect();

  console.log("Source counts:");
  for (const table of TABLES) {
    const { rows } = await source.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
    console.log(`  ${table}: ${rows[0].n}`);
  }

  console.log("\nPreparing target...");
  await target.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  await target.query(`
    TRUNCATE
      "PromptUsage",
      "Favorite",
      "MediaExample",
      "PromptKeyword",
      "Prompt",
      "Keyword",
      "Category",
      "User"
    RESTART IDENTITY CASCADE
  `);

  console.log("\nCopying data...");
  for (const table of TABLES) {
    await copyTable(source, target, table);
  }

  await resetSequences(target);

  console.log("\nTarget counts:");
  for (const table of TABLES) {
    const { rows } = await target.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
    console.log(`  ${table}: ${rows[0].n}`);
  }

  await source.end();
  await target.end();
  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
