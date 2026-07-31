import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

function Field({ f, value, onChange }) {
  const base = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none";
  if (f.type === "select")
    return (
      <select data-testid={`field-${f.key}`} className={base} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  if (f.type === "textarea")
    return <textarea data-testid={`field-${f.key}`} className={base} rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  return (
    <input
      data-testid={`field-${f.key}`}
      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
      className={base}
      value={value ?? ""}
      onChange={(e) => onChange(f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
    />
  );
}

export default function CrudManager({ title, endpoint, testid, fields, columns, canWrite = true, renderExtra }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // form object or null
  const [editId, setEditId] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get(`/${endpoint}`); setItems(data); }
    catch (e) { toast.error(errMsg(e)); }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [endpoint]);

  const emptyForm = () => Object.fromEntries(fields.map((f) => [f.key, f.default ?? (f.type === "number" ? 0 : "")]));

  const openNew = () => { setEditId(null); setModal(emptyForm()); };
  const openEdit = (it) => { setEditId(it.id); setModal({ ...emptyForm(), ...it }); };

  const save = async () => {
    const payload = {};
    fields.forEach((f) => { payload[f.key] = modal[f.key]; });
    try {
      if (editId) await api.put(`/${endpoint}/${editId}`, payload);
      else await api.post(`/${endpoint}`, payload);
      toast.success(`${title} saved`);
      setModal(null); load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    try { await api.delete(`/${endpoint}/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  const isOwner = user?.role === "owner";

  return (
    <div data-testid={`${testid}-page`}>
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Manage</div>
          <h1 className="font-head font-extrabold text-3xl sm:text-4xl tracking-tight">{title}</h1>
        </div>
        {canWrite && (
          <button data-testid={`${testid}-add-btn`} onClick={openNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> New {title.replace(/s$/, "")}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-border rounded-md p-12 text-center text-muted-foreground" data-testid={`${testid}-empty`}>
          No {title.toLowerCase()} yet.
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {columns.map((c) => <th key={c.key} className="text-left font-semibold px-4 py-3 whitespace-nowrap">{c.label}</th>)}
                  {canWrite && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid={`${testid}-row`}>
                    {columns.map((c) => <td key={c.key} className="px-4 py-3 whitespace-nowrap">{c.render ? c.render(it) : String(it[c.key] ?? "—")}</td>)}
                    {canWrite && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEdit(it)} data-testid={`${testid}-edit-btn`} className="p-1.5 rounded hover:bg-muted transition-colors"><Pencil className="w-4 h-4" /></button>
                        {isOwner && <button onClick={() => del(it.id)} data-testid={`${testid}-delete-btn`} className="p-1.5 rounded hover:bg-muted text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>}
                        {renderExtra && renderExtra(it, load)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal(null)} />
          <div className="relative bg-card border border-border rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" data-testid={`${testid}-modal`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-head font-bold text-xl">{editId ? "Edit" : "New"} {title.replace(/s$/, "")}</h2>
              <button onClick={() => setModal(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">{f.label}</label>
                  <Field f={f} value={modal[f.key]} onChange={(v) => setModal((m) => ({ ...m, [f.key]: v }))} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} data-testid={`${testid}-save-btn`} className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">Save</button>
              <button onClick={() => setModal(null)} className="px-5 py-2.5 rounded-md border border-border hover:bg-muted transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
