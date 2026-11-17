import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { toast } from "sonner";
import { Plus, LifeBuoy, Clock, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { ModalShell } from "../components/crud/CrudParts";
import { inp, priBadge, statBadge, AttachmentList, AttachButton, MessageThread, ReplyBox } from "../components/dataentry/TicketParts";

const empty = { title: "", category: "General", priority: "normal", description: "", hours_requested: 0, attachments: [] };
const lbl = "block text-xs uppercase tracking-wider text-muted-foreground mb-1.5";

function TicketCard({ t, onReply }) {
  const [open, setOpen] = useState(false);
  const count = t.messages?.length || 0;
  return (
    <div className="border border-border rounded-md bg-card p-5" data-testid="ticket-card">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="font-head font-bold break-words min-w-0">{t.title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statBadge[t.status] || "bg-muted"}`} data-testid="ticket-status">{(t.status || "open").replace("_", " ")}</span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t.category}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priBadge[t.priority]}`}>{t.priority}</span>
      </div>
      <p className="text-sm text-muted-foreground mb-3 break-words">{t.description || "—"}</p>
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3"><Clock className="w-3.5 h-3.5" /> {t.hours_requested || 0} hrs requested</div>
      <AttachmentList files={t.attachments} />
      <button onClick={() => setOpen((o) => !o)} data-testid="ticket-thread-toggle" className="mt-3 w-full flex items-center justify-between text-sm font-medium py-2 border-t border-border">
        <span className="inline-flex items-center gap-1.5"><MessageSquare className="w-4 h-4 text-primary" /> {count ? `${count} message${count > 1 ? "s" : ""}` : "Message the team"}</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div data-testid="ticket-thread-panel">
          <MessageThread messages={t.messages} mine="owner" />
          <ReplyBox onSend={(m) => onReply(t.id, m)} />
        </div>
      )}
    </div>
  );
}

function NewTicketModal({ modal, setModal, onSave, onClose }) {
  const set = (k) => (e) => setModal({ ...modal, [k]: e.target.value });
  return (
    <ModalShell title="New data-entry ticket" onClose={onClose} testid="ticket-modal">
      <div className="space-y-4">
        <div><label className={lbl}>Title</label><input data-testid="ticket-title" className={inp} value={modal.title} onChange={set("title")} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={lbl}>Category</label>
            <select data-testid="ticket-category" className={inp} value={modal.category} onChange={set("category")}>
              {["General", "Data Import", "Job Setup", "Employee Setup", "Equipment/Vehicles", "Estimates"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Priority</label>
            <select data-testid="ticket-priority" className={inp} value={modal.priority} onChange={set("priority")}>
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
            </select>
          </div>
        </div>
        <div><label className={lbl}>Hours requested</label><input data-testid="ticket-hours" type="number" inputMode="decimal" className={inp} value={modal.hours_requested} onChange={set("hours_requested")} /></div>
        <div><label className={lbl}>Details</label><textarea data-testid="ticket-description" rows={3} className={inp} value={modal.description} onChange={set("description")} /></div>
        <div>
          <label className={lbl}>Files (spreadsheets, photos, PDFs)</label>
          <AttachmentList files={modal.attachments} onRemove={(p) => setModal({ ...modal, attachments: modal.attachments.filter((f) => f.path !== p) })} />
          <AttachButton onAdd={(f) => setModal((m) => ({ ...m, attachments: [...m.attachments, f] }))} />
        </div>
      </div>
      <button data-testid="ticket-save-btn" onClick={onSave} className="w-full mt-6 py-3 rounded-md bg-primary text-primary-foreground font-semibold">Submit ticket</button>
    </ModalShell>
  );
}

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
    if (!modal.title.trim()) return toast.error("Title is required");
    try {
      await api.post("/data-entry-tickets", { ...modal, hours_requested: Number(modal.hours_requested) });
      toast.success("Ticket submitted — our data-entry team will pick it up"); setModal(null); load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const reply = async (id, msg) => {
    const { data } = await api.post(`/data-entry-tickets/${id}/messages`, msg);
    setItems((list) => list.map((t) => (t.id === id ? data : t)));
    toast.success("Reply sent");
  };

  return (
    <div data-testid="data-entry-page">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Included with membership</div>
          <h1 className="font-head font-extrabold text-3xl sm:text-4xl tracking-tight">Data-entry assistance</h1>
          <p className="text-muted-foreground text-sm mt-1">Create a ticket, attach your files, and chat with our team right here.</p>
        </div>
        <button data-testid="ticket-add-btn" onClick={() => setModal({ ...empty, attachments: [] })}
          className="inline-flex items-center gap-2 px-5 py-3 sm:py-2.5 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
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
          {items.map((t) => <TicketCard key={t.id} t={t} onReply={reply} />)}
        </div>
      )}

      {modal && <NewTicketModal modal={modal} setModal={setModal} onSave={save} onClose={() => setModal(null)} />}
    </div>
  );
}
