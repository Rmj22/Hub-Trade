import { useEffect, useState, useCallback } from "react";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast, Toaster } from "sonner";
import { ShieldCheck, Building2, Users, Ticket, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import { AdminStat, TicketsTable, TicketModal } from "../components/admin/AdminParts";

export default function AdminControl() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [edit, setEdit] = useState(null);

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([api.get("/admin/stats"), api.get("/admin/data-entry-tickets")]);
      setStats(s.data); setTickets(t.data);
    } catch (e) { toast.error(errMsg(e)); }
  }, []);

  useEffect(() => {
    if (user === null) return;
    if (user === false) { nav("/login"); return; }
    if (!user.is_superadmin) { nav("/app"); return; }
    load();
  }, [user, nav, load]);

  const saveTicket = async () => {
    try {
      await api.put(`/admin/data-entry-tickets/${edit.id}`, { status: edit.status, admin_notes: edit.admin_notes });
      toast.success("Ticket updated"); setEdit(null); load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (user && !user.is_superadmin) return null;
  if (!user || !stats) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

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
          <AdminStat icon={Building2} label="Companies" value={stats.companies} />
          <AdminStat icon={Users} label="Users" value={stats.users} />
          <AdminStat icon={Ticket} label="Total tickets" value={stats.tickets} />
          <AdminStat icon={Ticket} label="Open tickets" value={stats.open_tickets} />
        </div>
        <h2 className="font-head font-bold text-2xl mb-4 tracking-tight">Data-entry tickets</h2>
        <TicketsTable tickets={tickets} onManage={(t) => setEdit({ ...t })} />
      </main>

      {edit && <TicketModal edit={edit} setEdit={setEdit} onSave={saveTicket} />}
    </div>
  );
}
