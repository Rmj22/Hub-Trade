import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Toaster } from "sonner";
import { ShieldCheck, Building2, Users, Ticket, Loader2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";

const statBadge = { open: "bg-primary/20 text-primary", in_progress: "bg-amber-500/15 text-amber-500", done: "bg-green-500/15 text-green-500" };
const priBadge = { low: "bg-muted text-muted-foreground", normal: "bg-blue-500/15 text-blue-500", high: "bg-destructive/15 text-destructive" };

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="border border-border rounded-md bg-card p-5">
      <Icon className="w-5 h-5 text-primary mb-3" />
      <div className="font-head font-extrabold text-3xl tracking-tight">{value}</div>
      <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export default function AdminControl() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [edit, setEdit] = useState(null);

  const load = async () => {
    try {
      const [s, t] = await Promise.all([api.get("/admin/stats"), api.get("/admin/data-entry-tickets")]);
      setStats(s.data); setTickets(t.data);
    } catch (e) { toast.error(errMsg(e)); }
  };

  useEffect(() => {
    if (user === null) return;
    if (user === false) { nav("/login"); return; }
    if (!user.is_superadmin) { nav("/app"); return; }
    load();
    // eslint-disable-next-line
  }, [user]);

  const saveTicket = async () => {
    try {
      await api.put(`/admin/data-entry-tickets/${edit.id}`, { status: edit.status, admin_notes: edit.admin_notes });
      toast.success("Ticket updated"); setEdit(null); load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (user === null || (user && user.is_superadmin && !stats)) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (user && !user.is_superadmin) return null;

  const inp = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none";

  return (
    <div className="min-h-screen bg-background" data-testid="admin-control-page">
      <Toaster position="top-right" richColors />
      <header className="h-16 border-b border-border flex items-center justify-between px-6 backdrop-blur-xl bg-card/70 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <span className="font-head font-extrabold text-lg tracking-tight">Hub Trade Admin Control</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button onClick={() => nav("/app")} data-testid="admin-back-btn" className="text-sm px-4 py-2 rounded-md border border-border hover:bg-muted transition-colors">Back to app</button>
        </div>
      </header>

      <main className="p-6 lg:p-10 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <Stat icon={Building2} label="Companies" value={stats.companies} />
          <Stat icon={Users} label="Users" value={stats.users} />
          <Stat icon={Ticket} label="Total tickets" value={stats.tickets} />
          <Stat icon={Ticket} label="Open tickets" value={stats.open_tickets} />
        </div>

        <h2 className="font-head font-bold text-2xl mb-4 tracking-tight">Data-entry tickets</h2>
        {tickets.length === 0 ? (
          <div className="border border-dashed border-border rounded-md p-12 text-center text-muted-foreground" data-testid="admin-tickets-empty">No tickets submitted yet.</div>
        ) : (
          <div className="border border-border rounded-md bg-card overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/50">
                {["Company", "Title", "Category", "Priority", "Hours", "By", "Status", ""].map((h) => <th key={h} className="text-left px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
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
                    <td className="px-4 py-3 text-right"><button onClick={() => setEdit({ ...t })} data-testid="admin-ticket-manage-btn" className="text-sm text-primary font-semibold whitespace-nowrap">Manage</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {edit && (
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
            <button data-testid="admin-ticket-save-btn" onClick={saveTicket} className="w-full mt-5 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold">Save</button>
          </div>
        </div>
      )}
    </div>
  );
}
