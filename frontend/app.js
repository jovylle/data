const API_URLS = {
  dev: "https://pmji7qzap2.execute-api.ap-southeast-1.amazonaws.com/dev",
  prod: "https://ltocvknz09.execute-api.ap-southeast-1.amazonaws.com/prod"
};

const API_STAGE = window.location.hostname.includes("localhost")
  ? "dev"
  : "prod";
const API_URL = API_URLS[API_STAGE];

async function loadNotes() {
  const res = await fetch(`${API_URL}/notes`);
  const data = await res.json();

  const ul = document.getElementById("notes");
  ul.innerHTML = "";

  if (!Array.isArray(data)) {
    console.warn("Unexpected notes payload", data);
    return;
  }

  data.forEach((note) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <b>${note.title}</b> - ${note.content || ""}
      <button onclick="removeNote('${note.id}')">Delete</button>
    `;
    ul.appendChild(li);
  });
}

async function addNote() {
  const title = document.getElementById("title").value;
  const content = document.getElementById("content").value;

  await fetch(`${API_URL}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content })
  });

  document.getElementById("title").value = "";
  document.getElementById("content").value = "";

  loadNotes();
}

async function removeNote(id) {
  await fetch(`${API_URL}/notes/${id}`, {
    method: "DELETE"
  });

  loadNotes();
}

loadNotes();
