// Hub Trade Companion — content script (injected on Hub Trade web app pages)
(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;
  if (window.__hubTradeCompanionLoaded) return;
  window.__hubTradeCompanionLoaded = true;

  // Floating quick-note button
  const btn = document.createElement("button");
  btn.id = "ht-companion-fab";
  btn.type = "button";
  btn.setAttribute("aria-label", "Save a Hub Trade quick note");
  btn.innerHTML = '<span class="ht-fab-plus">+</span><span class="ht-fab-label">Quick note</span>';
  document.documentElement.appendChild(btn);

  function toast(message, ok = true) {
    const t = document.createElement("div");
    t.className = "ht-companion-toast" + (ok ? "" : " ht-error");
    t.textContent = message;
    document.documentElement.appendChild(t);
    requestAnimationFrame(() => t.classList.add("ht-show"));
    setTimeout(() => {
      t.classList.remove("ht-show");
      setTimeout(() => t.remove(), 300);
    }, 2200);
  }

  btn.addEventListener("click", () => {
    const selection = String(window.getSelection() || "").trim();
    const preset = selection || "";
    const text = window.prompt("Quick note for Hub Trade:", preset);
    if (text && text.trim()) {
      api.runtime.sendMessage(
        { type: "ADD_NOTE", text: text.trim(), source: location.href },
        (res) => {
          if (res && res.ok) toast("Saved to Hub Trade Companion");
          else toast("Could not save note", false);
        }
      );
    }
  });
})();
