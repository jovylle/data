import { supabaseAdmin } from "../supabaseAdmin.js";
import { json } from "../utils/response.js";
import { getQueryParams, toPositiveInt } from "../utils/query.js";

export async function getNotifications(event) {
  const supabase = supabaseAdmin();
  const query = getQueryParams(event);
  const limit = toPositiveInt(query.limit, 100, 500);

  let request = supabase
    .from("notification_items")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (query.tag) request = request.contains("tags", [query.tag]);
  if (query.type) request = request.eq("type", query.type);

  const { data, error } = await request;
  if (error) return json(500, { error });
  return json(200, data);
}
