const KEY = "ht_saved_login";

export function saveLogin(email, password) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ email, password }));
    if (window.PasswordCredential && navigator.credentials?.store) {
      navigator.credentials.store(new window.PasswordCredential({ id: email, password, name: email })).catch(() => {});
    }
  } catch { /* storage unavailable */ }
}

export function loadLogin() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}

export function clearLogin() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
