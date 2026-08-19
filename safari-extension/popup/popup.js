// Hub Trade Companion — popup logic
const api = typeof browser !== "undefined" ? browser : chrome;

const LINKS = [
  { label: "Dashboard", path: "/app" },
  { label: "Jobs", path: "/app/jobs" },
  { label: "Time Cards", path: "/app/timecards" },
  { label: "Estimates", path: "/app/estimates" },
  { label: "Data-Entry", path: "/app/data-entry" },
  { label: "Audit Logs", path: "/app/audit-logs" },
];

let appUrl = "https://trade-hub-910.emergent.host";

function send(message) {
  return new Promise((resolve) => {
    try {
      api.runtime.sendMessage(message, (res) => resolve(res));
    } catch (e) {
      resolve(null);
    }
  });
}

function openUrl(url) {
  api.tabs.create({ url });
  window.close();
}

function timeAgo(iso) {
  const d = new Date(iso);
  const diff = Math.round((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  const h = Math.round(diff / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString();
}

function renderLinks() {
  const wrap = document.getElementById("ht-links");
  wrap.innerHTML = "";
  LINKS.forEach((l) => {
    const b = document.createElement("button");
    b.className = "ht-link";
    b.type = "button";
    b.textContent = l.label;
    b.addEventListener("click", () => openUrl(appUrl.replace(/\/$/, "") + l.path));
    wrap.appendChild(b);
  });
}

function renderNotes(notes) {
  const list = document.getElementById("ht-notes");
  const clearBtn = document.getElementById("ht-clear-notes");
  list.innerHTML = "";
  if (!notes || notes.length === 0) {
    const li = document.createElement("li");
    li.className = "ht-empty";
    li.textContent = "No notes yet. Add one above, right-click selected text on any page, or tap the on-page button.";
    list.appendChild(li);
    clearBtn.hidden = true;
    return;
  }
  clearBtn.hidden = false;
  notes.forEach((n) => {
    const li = document.createElement("li");
    li.className = "ht-note";
    const txt = document.createElement("div");
    txt.className = "ht-note-text";
    txt.textContent = n.text;
    const time = document.createElement("span");
    time.className = "ht-note-time";
    time.textContent = timeAgo(n.createdAt);
    txt.appendChild(time);
    const del = document.createElement("button");
    del.className = "ht-note-del";
    del.type = "button";
    del.textContent = "×";
    del.title = "Delete note";
    del.addEventListener("click", async () => {
      await send({ type: "DELETE_NOTE", id: n.id });
      refresh();
    });
    li.appendChild(txt);
    li.appendChild(del);
    list.appendChild(li);
  });
}

async function refresh() {
  const state = await send({ type: "GET_STATE" });
  if (state && state.appUrl) appUrl = state.appUrl;
  renderNotes(state ? state.notes : []);
}

document.addEventListener("DOMContentLoaded", async () => {
  renderLinks();
  await refresh();

  document.getElementById("ht-add-note").addEventListener("click", async () => {
    const input = document.getElementById("ht-note-input");
    const text = input.value.trim();
    if (!text) return;
    await send({ type: "ADD_NOTE", text, source: "popup" });
    input.value = "";
    refresh();
  });

  document.getElementById("ht-clear-notes").addEventListener("click", async () => {
    await send({ type: "CLEAR_NOTES" });
    refresh();
  });

  document.getElementById("ht-open-app").addEventListener("click", () => {
    openUrl(appUrl);
  });
});
