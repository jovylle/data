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

async function fetchPublicRepos(username, token) {
  const headers = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "portfolio-sync",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const repos = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `https://api.github.com/users/${encodeURIComponent(username)}/repos?type=public&per_page=${perPage}&page=${page}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API ${res.status}: ${text}`);
    }

    const batch = await res.json();
    repos.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return repos;
}

async function main() {
  const [, , usernameArg] = process.argv;

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

  const username = usernameArg ?? process.env.GITHUB_USERNAME;
  if (!username) {
    console.error(
      "Usage: node scripts/sync-github.js <github-username>\nOr set GITHUB_USERNAME in .env"
    );
    process.exit(1);
  }

  const token = process.env.GITHUB_TOKEN; // optional; increases rate limit

  console.log(`Fetching public repos for ${username}...`);
  const repos = await fetchPublicRepos(username, token);
  console.log(`Found ${repos.length} public repo(s).`);

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("begin");

    const insertNew = `
      insert into portfolio_projects (
        project_key, source, github_id, slug, title, description, repo_url,
        status, visibility_private, tech, raw
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11::jsonb)
    `;

    let inserted = 0;
    let skipped = 0;

    for (const repo of repos) {
      const existing = await client.query(
        "select 1 from portfolio_projects where github_id = $1",
        [repo.id]
      );

      if (existing.rowCount > 0) {
        skipped += 1;
        continue;
      }

      const projectKey = `github:${repo.id}`;
      const tech = Array.isArray(repo.topics) ? repo.topics : [];
      const title = repo.name ?? "Untitled";

      await client.query(insertNew, [
        projectKey,
        "github",
        repo.id,
        repo.name ?? null,
        title,
        repo.description ?? null,
        repo.html_url ?? null,
        "published",
        Boolean(repo.private),
        tech,
        JSON.stringify(repo),
      ]);
      inserted += 1;
    }

    await client.query("commit");
    console.log(`Synced ${repos.length} repo(s): ${inserted} new, ${skipped} already in DB (unchanged).`);
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

await main();
