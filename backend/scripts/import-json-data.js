import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
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

async function readJson(path) {
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
}

async function main() {
  const [, , dataDirArg = "../old_jsons/data"] = process.argv;
  const dataDir = resolve(process.cwd(), dataDirArg);

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

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("begin");

    const [
      profile,
      resume,
      testPayload,
      highlightsPayload,
      logsPayload,
      legacyProjectsPayload,
      personalProjectsPayload,
      blogIndex
    ] = await Promise.all([
      readJson(join(dataDir, "profile.json")),
      readJson(join(dataDir, "resume.json")),
      readJson(join(dataDir, "test.json")),
      readJson(join(dataDir, "highlights.json")),
      readJson(join(dataDir, "function-logs.json")),
      readJson(join(dataDir, "projects.json")),
      readJson(join(dataDir, "personal-projects.json")),
      readJson(join(dataDir, "blogs/index.json"))
    ]);

    await client.query("truncate table content_documents restart identity cascade");
    await client.query("truncate table portfolio_projects restart identity cascade");
    await client.query("truncate table blog_posts restart identity cascade");
    await client.query("truncate table highlights restart identity cascade");
    await client.query("truncate table notification_items restart identity cascade");
    await client.query("truncate table function_logs restart identity cascade");

    const contentDocs = [
      ["profile", profile, "profile.json"],
      ["resume", resume, "resume.json"],
      ["test", testPayload, "test.json"],
      ["highlights_notes", { notes: asArray(highlightsPayload?.notes) }, "highlights.json"]
    ];

    for (const [key, payload, sourceFile] of contentDocs) {
      await client.query(
        `insert into content_documents (key, payload, source_file, updated_at)
         values ($1, $2::jsonb, $3, now())`,
        [key, JSON.stringify(payload), sourceFile]
      );
    }

    for (const [index, row] of asArray(highlightsPayload?.highlights).entries()) {
      await client.query(
        `insert into highlights (title, tag, year, technologies, description, links, sort_order, raw)
         values ($1, $2, $3, $4::text[], $5, $6::jsonb, $7, $8::jsonb)`,
        [
          row.title ?? "",
          row.tag ?? null,
          row.year ?? null,
          asArray(row.technologies),
          row.description ?? null,
          JSON.stringify(asArray(row.links)),
          index,
          JSON.stringify(row ?? {})
        ]
      );
    }

    const projectRows = [];
    for (const [idx, row] of asArray(legacyProjectsPayload?.projects).entries()) {
      const keyBase = row.id ?? row.slug ?? slugify(row.title || `legacy-${idx}`);
      projectRows.push({
        projectKey: `legacy:${keyBase}`,
        source: "legacy-projects",
        externalId: toInteger(row.id),
        slug: row.slug ?? null,
        title: row.title ?? `Legacy Project ${idx + 1}`,
        description: row.description ?? null,
        body: row.body ?? null,
        thumbnail: row.thumbnail ?? null,
        status: row.status ?? null,
        visibilityPrivate: Boolean(row.private),
        updatedAt: null,
        priorityScore: null,
        tech: [],
        repoUrl: row.repo ?? null,
        githubId: null,
        links: asArray(row.links),
        raw: row ?? {}
      });
    }

    for (const [idx, row] of asArray(personalProjectsPayload?.projects).entries()) {
      const keyBase = row.slug ?? row.id ?? slugify(row.title || `personal-${idx}`);
      projectRows.push({
        projectKey: `personal:${keyBase}`,
        source: "personal-projects",
        externalId: toInteger(row.id),
        slug: row.slug ?? null,
        title: row.title ?? `Personal Project ${idx + 1}`,
        description: row.description ?? null,
        body: row.body ?? null,
        thumbnail: row.thumbnail ?? null,
        status: row.draft_or_published ?? row.status ?? null,
        visibilityPrivate: Boolean(row.private),
        updatedAt: toTimestamp(row.updated_at),
        priorityScore: toInteger(row.priority_score),
        tech: asArray(row.tech),
        repoUrl: row.repo ?? null,
        githubId: toInteger(row.github?.id),
        links: asArray(row.links),
        raw: row ?? {}
      });
    }

    for (const row of projectRows) {
      await client.query(
        `insert into portfolio_projects (
           project_key, source, external_id, slug, title, description, body, thumbnail, status,
           visibility_private, updated_at, priority_score, tech, repo_url, github_id, links, raw
         ) values (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           $10, $11, $12, $13::text[], $14, $15, $16::jsonb, $17::jsonb
         )`,
        [
          row.projectKey,
          row.source,
          row.externalId,
          row.slug,
          row.title,
          row.description,
          row.body,
          row.thumbnail,
          row.status,
          row.visibilityPrivate,
          row.updatedAt,
          row.priorityScore,
          row.tech,
          row.repoUrl,
          row.githubId,
          JSON.stringify(row.links),
          JSON.stringify(row.raw)
        ]
      );
    }

    for (const item of asArray(blogIndex)) {
      const detailPath = join(dataDir, "blogs", `${item.slug}.json`);
      const detail = await readJson(detailPath);
      const publishedAt = toTimestamp(detail.date ?? item.date);

      await client.query(
        `insert into blog_posts (
           slug, title, excerpt, author, content, body, status, visibility_private,
           featured, draft, thumbnail, load_readme_from_this_repo, categories, tags,
           published_at, raw, updated_at
         ) values (
           $1, $2, $3, $4, $5, $6, $7, $8,
           $9, $10, $11, $12, $13::text[], $14::text[],
           $15, $16::jsonb, now()
         )`,
        [
          item.slug,
          detail.title ?? item.title ?? item.slug,
          detail.excerpt ?? null,
          detail.author ?? null,
          detail.content ?? null,
          detail.body ?? null,
          detail.status ?? (item.draft ? "draft" : "published"),
          Boolean(detail.private),
          Boolean(detail.featured ?? item.featured),
          Boolean(detail.draft ?? item.draft),
          detail.thumbnail ?? item.thumbnail ?? null,
          detail.load_readme_from_this_repo ?? null,
          asArray(item.categories),
          asArray(detail.tags),
          publishedAt,
          JSON.stringify({ index: item, detail })
        ]
      );
    }

    const notificationIndex = await readJson(join(dataDir, "notifications/index.json"));
    for (const fileName of asArray(notificationIndex?.files)) {
      const path = join(dataDir, "notifications", fileName);
      const payload = await readJson(path);
      const dateMatch = fileName.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
      const batchDate = dateMatch ? dateMatch[1] : null;

      for (const row of asArray(payload?.notifications)) {
        await client.query(
          `insert into notification_items (
             id, type, title, message, persistent, tags, occurred_at, batch_date, source_file, raw
           ) values (
             $1, $2, $3, $4, $5, $6::text[], $7, $8, $9, $10::jsonb
           )
           on conflict (id) do update set
             type = excluded.type,
             title = excluded.title,
             message = excluded.message,
             persistent = excluded.persistent,
             tags = excluded.tags,
             occurred_at = excluded.occurred_at,
             batch_date = excluded.batch_date,
             source_file = excluded.source_file,
             raw = excluded.raw`,
          [
            row.id ?? `${fileName}:${slugify(row.title ?? row.message ?? "notification")}`,
            row.type ?? null,
            row.title ?? "",
            row.message ?? "",
            Boolean(row.persistent),
            asArray(row.tags),
            toTimestamp(row.timestamp),
            batchDate,
            fileName,
            JSON.stringify(row ?? {})
          ]
        );
      }
    }

    for (const row of asArray(logsPayload?.logs)) {
      await client.query(
        `insert into function_logs (
           logged_at, environment, node_version, region, function_instance_id,
           memory_limit, success, error, stats, raw
         ) values (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9::jsonb, $10::jsonb
         )`,
        [
          toTimestamp(row.timestamp),
          row.environment ?? null,
          row.nodeVersion ?? null,
          row.region ?? null,
          row.functionInstanceId ?? null,
          toInteger(row.memoryLimit),
          row.success === undefined ? null : Boolean(row.success),
          row.error ?? null,
          JSON.stringify(row.stats ?? {}),
          JSON.stringify(row ?? {})
        ]
      );
    }

    await client.query("commit");
    console.log(`Imported JSON data from ${dataDir}`);
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

await main();
