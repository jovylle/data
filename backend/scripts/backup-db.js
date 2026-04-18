/**
 * Backup Postgres (Supabase) data used by this app.
 *
 * Run from backend/: npm run backup:db
 *
 * 1) Uses pg_dump when available (public schema, custom format → pg_restore).
 * 2) If pg_dump is not installed, exports known app tables to JSON under backups/json-<iso>/.
 *
 * Requires SUPABASE_DATABASE_URL in .env (direct Postgres URI, not the pooler, for pg_dump).
 *
 * Flags: --json  skip pg_dump and write JSON only
 */
import { mkdir, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { Client } from "pg";

const APP_TABLES = [
  "notes",
  "content_documents",
  "portfolio_projects",
  "blog_posts",
  "highlights",
  "notification_items",
  "function_logs",
];

function loadDotEnv(raw) {
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function backupJson(connectionString, outDir) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const manifest = {
      created_at: new Date().toISOString(),
      mode: "json",
      tables: [],
    };

    for (const table of APP_TABLES) {
      const { rows } = await client.query(
        `select * from ${client.escapeIdentifier(table)}`
      );
      const file = join(outDir, `${table}.json`);
      await writeFile(file, JSON.stringify(rows, null, 2), "utf-8");
      manifest.tables.push({ name: table, rows: rows.length, file: `${table}.json` });
    }

    await writeFile(
      join(outDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf-8"
    );
    return manifest;
  } finally {
    await client.end();
  }
}

async function main() {
  try {
    const envRaw = await readFile(join(process.cwd(), ".env"), "utf-8");
    loadDotEnv(envRaw);
  } catch {
    // shell-provided env vars
  }

  const connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) {
    console.error("Set SUPABASE_DATABASE_URL in backend/.env (or export it).");
    process.exit(1);
  }

  const backupsRoot = join(process.cwd(), "backups");
  await mkdir(backupsRoot, { recursive: true });

  const wantJsonOnly = process.argv.includes("--json");
  const dumpPath = join(backupsRoot, `db-${stamp()}.dump`);

  if (!wantJsonOnly) {
    const r = spawnSync(
      "pg_dump",
      [
        "-d",
        connectionString,
        "--schema=public",
        "--no-owner",
        "--no-acl",
        "-Fc",
        "-f",
        dumpPath,
      ],
      { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 }
    );

    if (r.error?.code === "ENOENT") {
      console.warn(
        "pg_dump not found (install Postgres client: brew install libpq && brew link --force libpq). Using JSON export instead."
      );
    } else if (r.status !== 0) {
      console.error(r.stderr || r.stdout || r.error);
      process.exit(1);
    } else {
      console.log(`Wrote ${dumpPath}`);
      console.log("Restore (example): pg_restore -d \"$SUPABASE_DATABASE_URL\" --clean --if-exists --no-owner --no-acl " + dumpPath);
      return;
    }
  }

  const jsonDir = join(backupsRoot, `json-${stamp()}`);
  await mkdir(jsonDir, { recursive: true });
  const manifest = await backupJson(connectionString, jsonDir);
  console.log(`Wrote JSON backup under ${jsonDir}`);
  console.log(`Tables: ${manifest.tables.map((t) => `${t.name}(${t.rows})`).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
