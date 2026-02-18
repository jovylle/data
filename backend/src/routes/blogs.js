import { supabaseAdmin } from "../supabaseAdmin.js";
import { json } from "../utils/response.js";
import { getQueryParams, toBoolean, toPositiveInt } from "../utils/query.js";

export async function getBlogs(event) {
  const supabase = supabaseAdmin();
  const query = getQueryParams(event);
  const includeDrafts = toBoolean(query.includeDrafts, false);
  const featuredOnly = toBoolean(query.featured, false);
  const limit = toPositiveInt(query.limit, 50, 200);

  let request = supabase
    .from("blog_posts")
    .select(
      "slug, title, excerpt, author, status, visibility_private, featured, draft, thumbnail, categories, tags, published_at"
    )
    .order("published_at", { ascending: false })
    .limit(limit);

  if (!includeDrafts) request = request.eq("draft", false);
  if (featuredOnly) request = request.eq("featured", true);
  if (query.category) request = request.contains("categories", [query.category]);
  if (query.tag) request = request.contains("tags", [query.tag]);

  const { data, error } = await request;
  if (error) return json(500, { error });
  return json(200, data);
}

export async function getBlogBySlug(slug) {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return json(500, { error });
  if (!data) return json(404, { error: "Blog not found" });
  return json(200, data);
}
