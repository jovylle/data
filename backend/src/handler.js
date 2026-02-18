import { json } from "./utils/response.js";
import { getNotes, addNote, updateNote, deleteNote } from "./routes/notes.js";
import {
  getProfile,
  getResume,
  getContentDocument
} from "./routes/content.js";
import { getHighlights } from "./routes/highlights.js";
import { getProjects, getProjectByKey } from "./routes/projects.js";
import { getBlogs, getBlogBySlug } from "./routes/blogs.js";
import { getNotifications } from "./routes/notifications.js";
import { getFunctionLogs } from "./routes/functionLogs.js";

export async function main(event) {
  const method = event.requestContext.http.method;
  const stage =
    event.requestContext.stage || event.requestContext.http?.stage;
  console.log("handler receives", { stage, rawPath: event.rawPath });

  let rawPath = event.rawPath ?? "/";
  if (stage && rawPath.startsWith(`/${stage}`)) {
    rawPath = rawPath.slice(stage.length + 1);
  } else if (rawPath.startsWith("/")) {
    const segments = rawPath.split("/");
    if (segments.length > 1) {
      rawPath = `/${segments.slice(2).join("/")}`;
    }
  }

  const path = rawPath || "/";

  if (method === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (path === "/notes" && method === "GET") {
    return getNotes();
  }

  if (path === "/notes" && method === "POST") {
    return addNote(event);
  }

  if (path.startsWith("/notes/") && method === "PUT") {
    const id = path.split("/")[2];
    return updateNote(event, id);
  }

  if (path.startsWith("/notes/") && method === "DELETE") {
    const id = path.split("/")[2];
    return deleteNote(id);
  }

  if (path === "/profile" && method === "GET") {
    return getProfile();
  }

  if (path === "/resume" && method === "GET") {
    return getResume();
  }

  if (path.startsWith("/content/") && method === "GET") {
    const key = path.split("/")[2];
    return getContentDocument(key);
  }

  if (path === "/highlights" && method === "GET") {
    return getHighlights();
  }

  if (path === "/projects" && method === "GET") {
    return getProjects(event);
  }

  if (path.startsWith("/projects/") && method === "GET") {
    const key = path.split("/")[2];
    return getProjectByKey(key);
  }

  if (path === "/blogs" && method === "GET") {
    return getBlogs(event);
  }

  if (path.startsWith("/blogs/") && method === "GET") {
    const slug = path.split("/")[2];
    return getBlogBySlug(slug);
  }

  if (path === "/notifications" && method === "GET") {
    return getNotifications(event);
  }

  if (path === "/function-logs" && method === "GET") {
    return getFunctionLogs(event);
  }

  return json(404, { error: "Not Found" });
}
