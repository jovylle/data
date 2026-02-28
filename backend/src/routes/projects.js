import { supabaseAdmin } from "../supabaseAdmin.js";
import { json } from "../utils/response.js";
import { getQueryParams, toBoolean, toPositiveInt } from "../utils/query.js";

export async function getProjects(event) {
  const supabase = supabaseAdmin();
  const query = getQueryParams(event);
  const includeDrafts = toBoolean(query.includeDrafts, false);
  const limit = toPositiveInt(query.limit, 100, 500);

  let request = supabase
    .from("portfolio_projects")
    .select(
      "project_key, slug, title, description, body, thumbnail, is_published, updated_at, priority_score, tech, repo_url, github_raw, github_id, links"
    )
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (query.is_published !== undefined) request = request.eq("is_published", toBoolean(query.is_published, true));
  if (!includeDrafts) request = request.eq("is_published", true);
  if (query.slug) request = request.eq("slug", query.slug);

  const { data, error } = await request;
  if (error) return json(500, { error });
  return json(200, data);
}

export async function getProjectByKey(key) {
  const supabase = supabaseAdmin();

  const byKey = await supabase
    .from("portfolio_projects")
    .select(
      "project_key, slug, title, description, body, thumbnail, is_published, updated_at, priority_score, tech, repo_url, github_raw, github_id, links"
    )
    .eq("project_key", key)
    .maybeSingle();

  if (byKey.error) return json(500, { error: byKey.error });
  if (byKey.data) return json(200, byKey.data);

  const bySlug = await supabase
    .from("portfolio_projects")
    .select(
      "project_key, slug, title, description, body, thumbnail, is_published, updated_at, priority_score, tech, repo_url, github_raw, github_id, links"
    )
    .eq("slug", key)
    .maybeSingle();

  if (bySlug.error) return json(500, { error: bySlug.error });
  if (!bySlug.data) return json(404, { error: "Project not found" });
  return json(200, bySlug.data);
}
