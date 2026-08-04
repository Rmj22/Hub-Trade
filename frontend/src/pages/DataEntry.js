import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { toast } from "sonner";
import { Plus, X, LifeBuoy, Clock } from "lucide-react";

const priBadge = { low: "bg-muted text-muted-foreground", normal: "bg-blue-500/15 text-blue-500", high: "bg-destructive/15 text-destructive" };
const statBadge = { open: "bg-primary/20 text-primary", in_progress: "bg-amber-500/15 text-amber-500", done: "bg-green-500/15 text-green-500" };

const empty = { title: "", category: "General", priority: "normal", description: "", hours_requested: 0 };

export default function DataEntryPage() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [hours, setHours] = useState(null);

  const load = () => {
    api.get("/data-entry-tickets").then((r) => setItems(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get("/dashboard").then((r) => setHours({ total: r.data.data_hours_total, used: r.data.data_hours_used, remaining: r.data.data_hours_remaining })).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.post("/data-entry-tickets", { ...modal, hours_requested: Number(modal.hours_requested) });
      toast.success("Ticket submitted — our data-entry team will pick it up"); setModal(null); load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const inp = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none";

  return (
    <div data-testid="data-entry-page">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Included with membership</div>
          <h1 className="font-head font-extrabold text-3xl sm:text-4xl tracking-tight">Data-entry assistance</h1>
          <p className="text-muted-foreground text-sm mt-1">Create a ticket and our team will help you get set up fast.</p>
        </div>
        <button data-testid="ticket-add-btn" onClick={() => setModal({ ...empty })}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> New ticket
        </button>
      </div>

      {hours && hours.total > 0 && (
        <div className="border border-border rounded-md bg-card p-5 mb-8" data-testid="data-entry-hours-meter">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">Data-entry hours remaining</span></div>
            <span className="font-head font-extrabold text-lg" data-testid="data-entry-hours-remaining">{hours.remaining} / {hours.total} hrs</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${hours.total ? Math.min(100, (hours.remaining / hours.total) * 100) : 0}%` }} />
          </div>
          <div className="text-xs text-muted-foreground mt-2">{hours.used} of your {hours.total}-hr plan requested this term</div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="border border-dashed border-border rounded-md p-12 text-center text-muted-foreground" data-testid="tickets-empty">
          <LifeBuoy className="w-8 h-8 mx-auto mb-3 text-primary" />
          No tickets yet. Need help importing data or setting up jobs? Create a ticket.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((t) => (
            <div key={t.id} className="border border-border rounded-md bg-card p-5" data-testid="ticket-card">
              <div className="flex items-center justify-between mb-2 gap-2">
                <h3 className="font-head font-bold">{t.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statBadge[t.status] || "bg-muted"}`}>{(t.status || "open").replace("_", " ")}</span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t.category}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priBadge[t.priority]}`}>{t.priority}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{t.description || "—"}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3.5 h-3.5" /> {t.hours_requested || 0} hrs requested</div>
              {t.admin_notes && <div className="mt-3 text-xs p-2 rounded bg-muted"><b>Team note:</b> {t.admin_notes}</div>}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal(null)} />
          <div className="relative bg-card border border-border rounded-md w-full max-w-lg p-6" data-testid="ticket-modal">
            <div className="flex items-center justify-between mb-6"><h2 className="font-head font-bold text-xl">New data-entry ticket</h2><button onClick={() => setModal(null)}><X className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Title</label><input data-testid="ticket-title" className={inp} value={modal.title} onChange={(e) => setModal({ ...modal, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Category</label>
                  <select data-testid="ticket-category" className={inp} value={modal.category} onChange={(e) => setModal({ ...modal, category: e.target.value })}>
                    {["General", "Data Import", "Job Setup", "Employee Setup", "Equipment/Vehicles", "Estimates"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Priority</label>
                  <select data-testid="ticket-priority" className={inp} value={modal.priority} onChange={(e) => setModal({ ...modal, priority: e.target.value })}>
                    <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
                  </select>
                </div>
              </div>
              <div><label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Hours requested</label><input data-testid="ticket-hours" type="number" className={inp} value={modal.hours_requested} onChange={(e) => setModal({ ...modal, hours_requested: e.target.value })} /></div>
              <div><label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Details</label><textarea data-testid="ticket-description" rows={3} className={inp} value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} /></div>
            </div>
            <button data-testid="ticket-save-btn" onClick={save} className="w-full mt-6 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold">Submit ticket</button>
          </div>
        </div>
      )}
    </div>
  );
}
