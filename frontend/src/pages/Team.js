import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { toast } from "sonner";
import { Plus, X, UserPlus, Trash2 } from "lucide-react";
import CrudManager from "../components/CrudManager";
import { useAuth } from "../context/AuthContext";

const roleBadge = { owner: "bg-primary/20 text-primary", foreman: "bg-blue-500/15 text-blue-500", employee: "bg-muted text-muted-foreground" };

export default function TeamPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [modal, setModal] = useState(null);

  const load = () => api.get("/team").then((r) => setMembers(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const changeRole = async (id, role) => {
    try { await api.put(`/team/${id}/role`, { role }); toast.success("Role updated"); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  const removeMember = async (id) => {
    if (!window.confirm("Remove this member's account?")) return;
    try { await api.delete(`/team/${id}`); toast.success("Member removed"); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  const save = async () => {
    try { await api.post("/team", modal); toast.success("Member added"); setModal(null); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const inp = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none";

  return (
    <div data-testid="team-page">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">People</div>
          <h1 className="font-head font-extrabold text-3xl sm:text-4xl tracking-tight">Team accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">Create login accounts for Foremen and Employees.</p>
        </div>
        <button data-testid="add-member-btn" onClick={() => setModal({ name: "", email: "", password: "", role: "employee" })}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
          <UserPlus className="w-4 h-4" /> Add member
        </button>
      </div>

      <div className="border border-border rounded-md bg-card overflow-hidden mb-10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/50"><th className="text-left px-4 py-3 font-semibold">Name</th><th className="text-left px-4 py-3 font-semibold">Email</th><th className="text-left px-4 py-3 font-semibold">Assign role</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0" data-testid="team-row">
                <td className="px-4 py-3 font-medium whitespace-nowrap">{m.name} {m.is_superadmin && <span className="ml-1 text-xs text-primary">★</span>}</td>
                <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                <td className="px-4 py-3">
                  <select
                    data-testid="member-role-select"
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value)}
                    className={`px-3 py-1.5 rounded-md border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none ${roleBadge[m.role]}`}
                  >
                    <option value="owner">Owner</option>
                    <option value="foreman">Foreman</option>
                    <option value="employee">Employee</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {m.id !== user?.id && (
                    <button onClick={() => removeMember(m.id)} data-testid="member-remove-btn" className="p-1.5 rounded hover:bg-muted text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="font-head font-bold text-2xl mb-4 tracking-tight">Employee records</h2>
      <EmployeeRecords />

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal(null)} />
          <div className="relative bg-card border border-border rounded-md w-full max-w-md p-6" data-testid="member-modal">
            <div className="flex items-center justify-between mb-6"><h2 className="font-head font-bold text-xl">Add member</h2><button onClick={() => setModal(null)}><X className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <input data-testid="member-name" className={inp} placeholder="Name" value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} />
              <input data-testid="member-email" className={inp} placeholder="Email" value={modal.email} onChange={(e) => setModal({ ...modal, email: e.target.value })} />
              <input data-testid="member-password" className={inp} placeholder="Temp password" value={modal.password} onChange={(e) => setModal({ ...modal, password: e.target.value })} />
              <select data-testid="member-role" className={inp} value={modal.role} onChange={(e) => setModal({ ...modal, role: e.target.value })}>
                <option value="employee">Employee</option><option value="foreman">Foreman</option><option value="owner">Owner</option>
              </select>
            </div>
            <button data-testid="member-save-btn" onClick={save} className="w-full mt-6 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold">Create account</button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeeRecords() {
  return (
    <CrudManager
      title="Employees" endpoint="employees" testid="employees"
      columns={[
        { key: "name", label: "Name" },
        { key: "role_title", label: "Title" },
        { key: "trade", label: "Trade" },
        { key: "hourly_rate", label: "Rate", render: (it) => `$${it.hourly_rate}/hr` },
        { key: "status", label: "Status" },
      ]}
      fields={[
        { key: "name", label: "Name", type: "text" },
        { key: "email", label: "Email", type: "text" },
        { key: "phone", label: "Phone", type: "text" },
        { key: "role_title", label: "Title", type: "text", default: "Laborer" },
        { key: "trade", label: "Trade", type: "select", options: ["General", "Electrical", "Plumbing", "HVAC", "Carpentry", "Concrete", "Roofing"], default: "General" },
        { key: "hourly_rate", label: "Hourly Rate ($)", type: "number" },
        { key: "status", label: "Status", type: "select", options: ["active", "inactive"], default: "active" },
      ]}
    />
  );
}
