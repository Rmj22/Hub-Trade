import { useEffect, useState, useRef, useCallback } from "react";
import { api, errMsg } from "../lib/api";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { EstimateCard, EstimateModal } from "../components/estimates/EstimateParts";

let lineSeq = 0;
const newLine = () => ({ _key: `li-${++lineSeq}`, desc: "", qty: 1, unit_price: 0 });
const withKeys = (li) => (li?.length ? li.map((l) => ({ ...l, _key: l._key || `li-${++lineSeq}` })) : [newLine()]);
const empty = { customer_name: "", customer_email: "", line_items: [], notes: "", photos: [], status: "draft" };

export default function EstimatesPage() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [editId, setEditId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const load = useCallback(() => api.get("/estimates").then((r) => setItems(r.data)).catch((e) => toast.error(errMsg(e))), []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditId(null); setModal({ ...empty, line_items: [newLine()], photos: [] }); };
  const openEdit = (e) => { setEditId(e.id); setModal({ ...empty, ...e, line_items: withKeys(e.line_items), photos: e.photos || [] }); };

  const save = async () => {
    try {
      const payload = { ...modal, line_items: modal.line_items.map((l) => ({ desc: l.desc, qty: Number(l.qty), unit_price: Number(l.unit_price) })) };
      if (editId) await api.put(`/estimates/${editId}`, payload);
      else await api.post("/estimates", payload);
      toast.success("Estimate saved"); setModal(null); load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const send = async (id) => {
    try { await api.post(`/estimates/${id}/send`); toast.success("Estimate emailed to customer"); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete estimate?")) return;
    try { await api.delete(`/estimates/${id}`); load(); } catch (e) { toast.error(errMsg(e)); }
  };

  const upload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setModal((m) => ({ ...m, photos: [...m.photos, data.path] }));
      toast.success("Photo added");
    } catch (err) { toast.error(errMsg(err)); }
    setUploading(false);
  };

  return (
    <div data-testid="estimates-page">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Sales</div>
          <h1 className="font-head font-extrabold text-3xl sm:text-4xl tracking-tight">Estimates</h1>
        </div>
        <button data-testid="estimates-add-btn" onClick={openNew}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> New estimate
        </button>
      </div>

      {items.length === 0 && <div className="border border-dashed border-border rounded-md p-12 text-center text-muted-foreground" data-testid="estimates-empty">No estimates yet.</div>}
      {items.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((e) => <EstimateCard key={e.id} e={e} onEdit={openEdit} onSend={send} onDelete={del} />)}
        </div>
      )}

      {modal && (
        <EstimateModal modal={modal} setModal={setModal} editing={!!editId} onSave={save} onClose={() => setModal(null)}
          onUpload={upload} uploading={uploading} fileRef={fileRef} newLine={newLine} />
      )}
    </div>
  );
}
