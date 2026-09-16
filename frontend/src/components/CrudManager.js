import { useEffect, useState, useCallback } from "react";
import { api, errMsg } from "../lib/api";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { CrudTable, CrudModal } from "./crud/CrudParts";

const emptyForm = (fields) => Object.fromEntries(fields.map((f) => [f.key, f.default ?? (f.type === "number" ? 0 : "")]));

export default function CrudManager({ title, endpoint, testid, fields, columns, canWrite = true, renderExtra }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [editId, setEditId] = useState(null);
  const singular = title.replace(/s$/, "");

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get(`/${endpoint}`); setItems(data); }
    catch (e) { toast.error(errMsg(e)); }
    setLoading(false);
  }, [endpoint]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditId(null); setModal(emptyForm(fields)); };
  const openEdit = (it) => { setEditId(it.id); setModal({ ...emptyForm(fields), ...it }); };

  const save = async () => {
    const payload = Object.fromEntries(fields.map((f) => [f.key, modal[f.key]]));
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
            <Plus className="w-4 h-4" /> New {singular}
          </button>
        )}
      </div>

      {loading && <div className="text-muted-foreground">Loading…</div>}
      {!loading && items.length === 0 && (
        <div className="border border-dashed border-border rounded-md p-12 text-center text-muted-foreground" data-testid={`${testid}-empty`}>
          No {title.toLowerCase()} yet.
        </div>
      )}
      {!loading && items.length > 0 && (
        <CrudTable items={items} columns={columns} canWrite={canWrite} isOwner={user?.role === "owner"} testid={testid}
          onEdit={openEdit} onDelete={del} renderExtra={renderExtra} reload={load} />
      )}

      {modal && (
        <CrudModal title={title} singular={singular} editing={!!editId} fields={fields} form={modal} setForm={setModal}
          onSave={save} onClose={() => setModal(null)} testid={testid} />
      )}
    </div>
  );
}
