import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { cachedGet } from "../lib/offline";
import { toast } from "sonner";
import { UserPlus, Trash2, Copy, KeyRound } from "lucide-react";
import CrudManager from "../components/CrudManager";
import { ModalShell } from "../components/crud/CrudParts";
import { useAuth } from "../context/AuthContext";

const roleBadge = { owner: "bg-primary/20 text-primary", foreman: "bg-blue-500/15 text-blue-500", employee: "bg-muted text-muted-foreground" };
const inp = "w-full px-3 py-3 sm:py-2 rounded-md border border-input bg-background text-base sm:text-sm focus:ring-2 focus:ring-primary focus:outline-none";

function CredentialsModal({ creds, onClose }) {
  const text = `Hub Trade login\nUsername: ${creds.username}\nPassword: ${creds.password}\nLog in at ${window.location.origin}/login`;
  const copy = async () => { try { await navigator.clipboard.writeText(text); toast.success("Copied"); } catch { toast.error("Copy failed"); } };
  const share = async () => { if (navigator.share) { try { await navigator.share({ title: "Hub Trade login", text }); } catch { /* cancelled */ } } else copy(); };
  return (
    <ModalShell title="Login created" onClose={onClose} testid="credentials-modal">
      <p className="text-sm text-muted-foreground mb-4">Share these with <span className="font-semibold text-foreground">{creds.name}</span>. The password is only shown once — employees log in free; only the owner account pays.</p>
      <div className="border border-border rounded-md bg-background p-4 space-y-3 mb-5">
        <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Username</div><div className="font-mono text-sm break-all" data-testid="cred-username">{creds.username}</div></div>
        <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Password</div><div className="font-mono text-lg font-bold" data-testid="cred-password">{creds.password}</div></div>
      </div>
      <div className="flex gap-3">
        <button onClick={copy} data-testid="cred-copy-btn" className="flex-1 py-3 rounded-md border border-border font-semibold inline-flex items-center justify-center gap-2 hover:bg-muted"><Copy className="w-4 h-4" /> Copy</button>
        <button onClick={share} data-testid="cred-share-btn" className="flex-1 py-3 rounded-md bg-primary text-primary-foreground font-semibold">Share</button>
      </div>
    </ModalShell>
  );
}

function MemberRow({ m, me, onRole, onRemove }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0" data-testid="team-row">
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{m.name} {m.is_superadmin && <span className="ml-1 text-xs text-primary">★</span>}</div>
        <div className="text-xs text-muted-foreground truncate">{m.email}</div>
      </div>
      <select data-testid="member-role-select" value={m.role} onChange={(e) => onRole(m.id, e.target.value)}
        className={`px-2 py-2 rounded-md border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none ${roleBadge[m.role]}`}>
        <option value="owner">Owner</option><option value="foreman">Foreman</option><option value="employee">Employee</option>
      </select>
      {m.id !== me ? (
        <button onClick={() => onRemove(m.id)} data-testid="member-remove-btn" className="p-2.5 rounded hover:bg-muted text-destructive min-w-[44px] min-h-[44px] inline-flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
      ) : <span className="w-[44px]" />}
    </div>
  );
}

export default function TeamPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [modal, setModal] = useState(null);
  const [creds, setCreds] = useState(null);

  const load = () => cachedGet("/team").then((r) => setMembers(r.data)).catch((e) => toast.error(errMsg(e)));
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
    if (!modal.name.trim()) return toast.error("Name is required");
    try {
      const { data } = await api.post("/team", { name: modal.name, role: modal.role, email: modal.email || null });
      setModal(null); setCreds({ ...data.credentials, name: data.name }); load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div data-testid="team-page">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">People</div>
          <h1 className="font-head font-extrabold text-3xl sm:text-4xl tracking-tight">Team accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">Add a person and we create their login for you. Employee logins are free.</p>
        </div>
        <button data-testid="add-member-btn" onClick={() => setModal({ name: "", email: "", role: "employee" })}
          className="inline-flex items-center gap-2 px-5 py-3 sm:py-2.5 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
          <UserPlus className="w-4 h-4" /> Add member
        </button>
      </div>

      <div className="border border-border rounded-md bg-card overflow-hidden mb-10">
        {members.map((m) => <MemberRow key={m.id} m={m} me={user?.id} onRole={changeRole} onRemove={removeMember} />)}
      </div>

      <h2 className="font-head font-bold text-2xl mb-4 tracking-tight">Employee records</h2>
      <EmployeeRecords />

      {modal && (
        <ModalShell title="Add member" onClose={() => setModal(null)} testid="member-modal">
          <div className="space-y-4">
            <input data-testid="member-name" className={inp} placeholder="Full name" value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} />
            <select data-testid="member-role" className={inp} value={modal.role} onChange={(e) => setModal({ ...modal, role: e.target.value })}>
              <option value="employee">Employee</option><option value="foreman">Foreman</option><option value="owner">Owner</option>
            </select>
            <input data-testid="member-email" type="email" className={inp} placeholder="Email (optional — used as username if given)" value={modal.email} onChange={(e) => setModal({ ...modal, email: e.target.value })} />
            <p className="text-xs text-muted-foreground inline-flex items-start gap-2"><KeyRound className="w-4 h-4 shrink-0 text-primary" /> A username and password are generated automatically and shown to you once to share.</p>
          </div>
          <button data-testid="member-save-btn" onClick={save} className="w-full mt-6 py-3 rounded-md bg-primary text-primary-foreground font-semibold">Create login</button>
        </ModalShell>
      )}
      {creds && <CredentialsModal creds={creds} onClose={() => setCreds(null)} />}
    </div>
  );
}

const EMPLOYEE_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "role_title", label: "Title" },
  { key: "trade", label: "Trade" },
  { key: "hourly_rate", label: "Rate", render: (it) => `$${it.hourly_rate}/hr` },
  { key: "status", label: "Status" },
];
const EMPLOYEE_FIELDS = [
  { key: "name", label: "Name", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "role_title", label: "Title", type: "text", default: "Laborer" },
  { key: "trade", label: "Trade", type: "select", options: ["General", "Electrical", "Plumbing", "HVAC", "Carpentry", "Concrete", "Roofing"], default: "General" },
  { key: "hourly_rate", label: "Hourly Rate ($)", type: "number" },
  { key: "status", label: "Status", type: "select", options: ["active", "inactive"], default: "active" },
];

function EmployeeRecords() {
  return <CrudManager title="Employees" endpoint="employees" testid="employees" columns={EMPLOYEE_COLUMNS} fields={EMPLOYEE_FIELDS} />;
}
