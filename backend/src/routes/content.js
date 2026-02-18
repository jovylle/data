import { supabaseAdmin } from "../supabaseAdmin.js";
import { json } from "../utils/response.js";

async function getDocumentByKey(key) {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("content_documents")
    .select("key, payload, source_file, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error) return { error };
  if (!data) return { notFound: true };
  return { data };
}

export async function getProfile() {
  const result = await getDocumentByKey("profile");
  if (result.error) return json(500, { error: result.error });
  if (result.notFound) return json(404, { error: "Profile not found" });
  return json(200, result.data.payload);
}

export async function getResume() {
  const result = await getDocumentByKey("resume");
  if (result.error) return json(500, { error: result.error });
  if (result.notFound) return json(404, { error: "Resume not found" });
  return json(200, result.data.payload);
}

export async function getContentDocument(key) {
  const result = await getDocumentByKey(key);
  if (result.error) return json(500, { error: result.error });
  if (result.notFound) return json(404, { error: "Document not found" });
  return json(200, result.data);
}
