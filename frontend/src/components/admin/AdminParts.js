import { X } from "lucide-react";

const statBadge = { open: "bg-primary/20 text-primary", in_progress: "bg-amber-500/15 text-amber-500", done: "bg-green-500/15 text-green-500" };
const priBadge = { low: "bg-muted text-muted-foreground", normal: "bg-blue-500/15 text-blue-500", high: "bg-destructive/15 text-destructive" };
const HEADERS = ["Company", "Title", "Category", "Priority", "Hours", "By", "Status", ""];
const inp = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none";

export function AdminStat({ icon: Icon, label, value }) {
  return (
    <div className="border border-border rounded-md bg-card p-5">
      <Icon className="w-5 h-5 text-primary mb-3" />
      <div className="font-head font-extrabold text-3xl tracking-tight">{value}</div>
      <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export function TicketsTable({ tickets, onManage }) {
  if (tickets.length === 0) {
    return <div className="border border-dashed border-border rounded-md p-12 text-center text-muted-foreground" data-testid="admin-tickets-empty">No tickets submitted yet.</div>;
  }
  return (
    <div className="border border-border rounded-md bg-card overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-muted/50">
          {HEADERS.map((h) => <th key={h} className="text-left px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
        </tr></thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid="admin-ticket-row">
              <td className="px-4 py-3 font-medium whitespace-nowrap">{t.company_name}</td>
              <td className="px-4 py-3">{t.title}</td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{t.category}</td>
              <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priBadge[t.priority]}`}>{t.priority}</span></td>
              <td className="px-4 py-3">{t.hours_requested || 0}</td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{t.created_by}</td>
              <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statBadge[t.status] || "bg-muted"}`}>{(t.status || "open").replace("_", " ")}</span></td>
              <td className="px-4 py-3 text-right"><button onClick={() => onManage(t)} data-testid="admin-ticket-manage-btn" className="text-sm text-primary font-semibold whitespace-nowrap">Manage</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TicketModal({ edit, setEdit, onSave }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={() => setEdit(null)} />
      <div className="relative bg-card border border-border rounded-md w-full max-w-lg p-6" data-testid="admin-ticket-modal">
        <div className="flex items-center justify-between mb-4"><h2 className="font-head font-bold text-xl">{edit.title}</h2><button onClick={() => setEdit(null)}><X className="w-5 h-5" /></button></div>
        <div className="text-sm text-muted-foreground mb-4">{edit.company_name} · {edit.category} · {edit.hours_requested || 0} hrs</div>
        <p className="text-sm mb-4">{edit.description || "—"}</p>
        <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Status</label>
        <select data-testid="admin-ticket-status" className={inp + " mb-4"} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
          <option value="open">Open</option><option value="in_progress">In progress</option><option value="done">Done</option>
        </select>
        <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Note to customer</label>
        <textarea data-testid="admin-ticket-notes" rows={3} className={inp} value={edit.admin_notes || ""} onChange={(e) => setEdit({ ...edit, admin_notes: e.target.value })} />
        <button data-testid="admin-ticket-save-btn" onClick={onSave} className="w-full mt-5 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold">Save</button>
      </div>
    </div>
  );
}
