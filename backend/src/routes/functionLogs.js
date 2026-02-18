import { supabaseAdmin } from "../supabaseAdmin.js";
import { json } from "../utils/response.js";
import { getQueryParams, toBoolean, toPositiveInt } from "../utils/query.js";

export async function getFunctionLogs(event) {
  const supabase = supabaseAdmin();
  const query = getQueryParams(event);
  const limit = toPositiveInt(query.limit, 50, 500);

  let request = supabase
    .from("function_logs")
    .select("*")
    .order("logged_at", { ascending: false })
    .limit(limit);

  if (query.success !== undefined) {
    request = request.eq("success", toBoolean(query.success));
  }

  const { data, error } = await request;
  if (error) return json(500, { error });
  return json(200, data);
}
