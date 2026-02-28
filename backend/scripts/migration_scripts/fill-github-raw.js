/**
 * One-time: fill portfolio_projects.github_raw from GitHub API for rows that have repo_url.
 * Extracts fork, id, html_url, created_at, updated_at, pushed_at.
 * Run: node scripts/migration_scripts/fill-github-raw.js
 * Env: SUPABASE_DATABASE_URL, GITHUB_TOKEN (required for one-time full run)
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";

function loadDotEnv(raw) {
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function parseOwnerRepo(repoUrl) {
  if (!repoUrl || !repoUrl.trim()) return null;
  const trimmed = repoUrl.trim().replace(/\/+$/, "");
  const m = trimmed.match(/https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

function toGithubRaw(data) {
  if (
    !data ||
    (data.fork == null &&
      data.id == null &&
      !data.html_url &&
      !data.created_at &&
      !data.updated_at &&
      !data.pushed_at)
  )
    return null;
  return {
    fork: data.fork ?? null,
    id: data.id ?? null,
    html_url: data.html_url ?? null,
    created_at: data.created_at ?? null,
    updated_at: data.updated_at ?? null,
    pushed_at: data.pushed_at ?? null,
  };
}

async function fetchRepo(owner, repo, token, retried = false) {
  const headers = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "portfolio-fill-github-raw",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { headers }
  );
  if (res.status === 403 && !retried) {
    const retryAfter = res.headers.get("Retry-After");
    const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60_000;
    console.warn(`Rate limited. Waiting ${wait / 1000}s... Set GITHUB_TOKEN in .env for 5000 req/hr.`);
    await new Promise((r) => setTimeout(r, wait));
    return fetchRepo(owner, repo, token, true);
  }
  if (!res.ok) return null;
  return res.json();
}

async function main() {
  try {
    const envRaw = await readFile(join(process.cwd(), ".env"), "utf-8");
    loadDotEnv(envRaw);
  } catch {
    // Allow shell-provided env vars.
  }

  const connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) {
    console.error("Set SUPABASE_DATABASE_URL before running this script");
    process.exit(1);
  }

  const token = process.env.GITHUB_TOKEN?.trim() || null;
  if (!token) {
    console.error("Set GITHUB_TOKEN in .env (or export it). One-time fill needs it to complete all rows.");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const { rows } = await client.query(
      `select project_key, repo_url from portfolio_projects
       where repo_url is not null and trim(repo_url) != ''
       and (github_raw is null or github_raw = 'null'::jsonb)`
    );

    if (rows.length === 0) {
      console.log("No rows missing github_raw. All set.");
      return;
    }

    let updated = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const parsed = parseOwnerRepo(row.repo_url);
      if (!parsed) continue;

      const data = await fetchRepo(parsed.owner, parsed.repo, token);
      const githubRaw = toGithubRaw(data);
      if (!githubRaw) continue;

      await client.query(
        `update portfolio_projects set github_raw = $1::jsonb where project_key = $2`,
        [JSON.stringify(githubRaw), row.project_key]
      );
      updated += 1;
      if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${rows.length}...`);
      await new Promise((r) => setTimeout(r, 80));
    }

    console.log(`Filled github_raw for ${updated} of ${rows.length} rows (only those missing it).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
