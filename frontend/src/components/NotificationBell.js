import { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { Bell, Check } from "lucide-react";

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef();

  const load = () => api.get("/notifications").then((r) => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  const markAll = async () => { await api.post("/notifications/read-all").catch(() => {}); load(); };
  const openPanel = () => { setOpen((o) => !o); };

  const fmt = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return ""; } };

  return (
    <div className="relative" ref={ref}>
      <button data-testid="notification-bell-btn" onClick={openPanel}
        className="relative p-2 rounded-md border border-border hover:bg-muted transition-colors" aria-label="Notifications">
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span data-testid="notification-unread-badge" className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-card border border-border rounded-md shadow-xl z-50" data-testid="notification-panel">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card">
            <span className="font-head font-bold text-sm">Notifications</span>
            {unread > 0 && <button onClick={markAll} data-testid="notification-mark-all-btn" className="text-xs text-primary font-semibold inline-flex items-center gap-1"><Check className="w-3 h-3" /> Mark all read</button>}
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">You're all caught up.</div>
          ) : (
            items.map((n) => (
              <div key={n.id} data-testid="notification-item" className={`px-4 py-3 border-b border-border last:border-0 ${!n.read ? "bg-primary/5" : ""}`}>
                <div className="flex items-start gap-2">
                  {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                  <div className={n.read ? "pl-4" : ""}>
                    <p className="text-sm">{n.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{fmt(n.created_at)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
