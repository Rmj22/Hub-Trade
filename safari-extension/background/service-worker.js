// Hub Trade Companion — background service worker (MV3, Safari/Chrome compatible)
const api = typeof browser !== "undefined" ? browser : chrome;

const DEFAULT_APP_URL = "https://trade-hub-910.emergent.host";
const MENU_ID = "hubtrade-save-note";

// ---- storage helpers ----
async function getState() {
  const { appUrl, notes } = await api.storage.local.get(["appUrl", "notes"]);
  return { appUrl: appUrl || DEFAULT_APP_URL, notes: Array.isArray(notes) ? notes : [] };
}

async function setNotes(notes) {
  await api.storage.local.set({ notes });
  await updateBadge();
}

async function updateBadge() {
  const { notes } = await getState();
  const count = notes.length;
  const text = count > 0 ? String(count > 99 ? "99+" : count) : "";
  try {
    await api.action.setBadgeText({ text });
    await api.action.setBadgeBackgroundColor({ color: "#D4FF00" });
  } catch (e) {
    /* setBadge* not fatal */
  }
}

function makeNote(text, source) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: (text || "").trim(),
    source: source || "",
    createdAt: new Date().toISOString(),
  };
}

async function addNote(text, source) {
  if (!text || !text.trim()) return null;
  const { notes } = await getState();
  const note = makeNote(text, source);
  notes.unshift(note);
  await setNotes(notes.slice(0, 200));
  return note;
}

function notify(title, message) {
  // Safari (esp. iOS) does not support the notifications API — guard + degrade gracefully.
  if (!api.notifications || typeof api.notifications.create !== "function") return;
  try {
    api.notifications.create({
      type: "basic",
      iconUrl: api.runtime.getURL("icons/icon-128.png"),
      title,
      message,
    });
  } catch (e) {
    /* notifications optional */
  }
}

// ---- lifecycle ----
api.runtime.onInstalled.addListener(async () => {
  const current = await api.storage.local.get(["appUrl", "notes"]);
  if (!current.appUrl) await api.storage.local.set({ appUrl: DEFAULT_APP_URL });
  if (!Array.isArray(current.notes)) await api.storage.local.set({ notes: [] });

  try {
    api.contextMenus.removeAll(() => {
      api.contextMenus.create({
        id: MENU_ID,
        title: 'Save "%s" as a Hub Trade note',
        contexts: ["selection"],
      });
    });
  } catch (e) {
    /* contextMenus may be unavailable in some contexts */
  }
  await updateBadge();
});

api.runtime.onStartup && api.runtime.onStartup.addListener(updateBadge);

// ---- context menu: save selected text as a quick note ----
api.contextMenus &&
  api.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId === MENU_ID && info.selectionText) {
      const note = await addNote(info.selectionText, info.pageUrl || "");
      if (note) notify("Note saved", note.text.slice(0, 80));
    }
  });

// ---- message bridge for popup + content script ----
api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg && msg.type) {
      case "GET_STATE": {
        sendResponse(await getState());
        break;
      }
      case "ADD_NOTE": {
        const note = await addNote(msg.text, msg.source);
        if (note) notify("Note saved", note.text.slice(0, 80));
        sendResponse({ ok: !!note, note });
        break;
      }
      case "DELETE_NOTE": {
        const { notes } = await getState();
        await setNotes(notes.filter((n) => n.id !== msg.id));
        sendResponse({ ok: true });
        break;
      }
      case "CLEAR_NOTES": {
        await setNotes([]);
        sendResponse({ ok: true });
        break;
      }
      case "SET_APP_URL": {
        await api.storage.local.set({ appUrl: msg.appUrl || DEFAULT_APP_URL });
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false, error: "unknown_message" });
    }
  })();
  return true; // keep the message channel open for async sendResponse
});
