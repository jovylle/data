import { supabaseAdmin } from "../supabaseAdmin.js";
import { json } from "../utils/response.js";

export async function getHighlights() {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("highlights")
    .select("id, title, tag, year, technologies, description, links, sort_order")
    .order("sort_order", { ascending: true });

  if (error) return json(500, { error });
  return json(200, data);
}
