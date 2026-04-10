import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { supabaseAdmin } from '../src/supabaseAdmin.js';

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

async function loadEnv() {
  try {
    const envRaw = await readFile(join(process.cwd(), ".env"), "utf-8");
    loadDotEnv(envRaw);
  } catch (err) {
    console.error("Could not load .env file");
  }
}

async function getPublishedProjects() {
  await loadEnv();

  const { data, error } = await supabaseAdmin()
    .from('portfolio_projects')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Published Projects:');
  data.forEach(project => {
    console.log(`- ${project.title} (${project.project_key})`);
  });
}

getPublishedProjects();