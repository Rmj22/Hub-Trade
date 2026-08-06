import { useEffect, useState, useRef } from "react";
import { api, errMsg } from "../lib/api";
import { toast } from "sonner";
import { Plus, X, Send, Trash2, Upload, Image as ImageIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const empty = { customer_name: "", customer_email: "", line_items: [{ desc: "", qty: 1, unit_price: 0 }], notes: "", photos: [], status: "draft" };

export default function EstimatesPage() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [editId, setEditId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const BACKEND = process.env.REACT_APP_BACKEND_URL;

  const load = () => api.get("/estimates").then((r) => setItems(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const total = (li) => li.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);

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

  const del = async (id) => { if (!window.confirm("Delete estimate?")) return; try { await api.delete(`/estimates/${id}`); load(); } catch (e) { toast.error(errMsg(e)); } };

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

  const inp = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none";

  return (
    <div data-testid="estimates-page">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Sales</div>
          <h1 className="font-head font-extrabold text-3xl sm:text-4xl tracking-tight">Estimates</h1>
        </div>
        <button data-testid="estimates-add-btn" onClick={() => { setEditId(null); setModal({ ...empty, line_items: [{ desc: "", qty: 1, unit_price: 0 }], photos: [] }); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> New estimate
        </button>
      </div>

      {items.length === 0 ? (
        <div className="border border-dashed border-border rounded-md p-12 text-center text-muted-foreground" data-testid="estimates-empty">No estimates yet.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((e) => (
            <div key={e.id} className="border border-border rounded-md bg-card p-5" data-testid="estimate-card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-head font-bold">{e.customer_name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.status === "sent" ? "bg-green-500/15 text-green-500" : "bg-muted text-muted-foreground"}`}>{e.status}</span>
              </div>
              <div className="text-xs text-muted-foreground mb-3">{e.customer_email || "no email"}</div>
              <div className="font-head font-extrabold text-2xl mb-1">${(e.total || 0).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mb-4">{e.line_items?.length || 0} line items · {e.photos?.length || 0} photos</div>
              <div className="flex gap-2">
                <button onClick={() => { setEditId(e.id); setModal({ ...empty, ...e, line_items: e.line_items?.length ? e.line_items : [{ desc: "", qty: 1, unit_price: 0 }], photos: e.photos || [] }); }}
                  data-testid="estimate-edit-btn" className="flex-1 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors">Edit</button>
                <button onClick={() => send(e.id)} data-testid="estimate-send-btn" className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-1"><Send className="w-3.5 h-3.5" /> Send</button>
                <button onClick={() => del(e.id)} data-testid="estimate-delete-btn" className="p-2 rounded-md border border-border text-destructive hover:bg-muted transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal(null)} />
          <div className="relative bg-card border border-border rounded-md w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" data-testid="estimate-modal">
            <div className="flex items-center justify-between mb-6"><h2 className="font-head font-bold text-xl">{editId ? "Edit" : "New"} estimate</h2><button onClick={() => setModal(null)}><X className="w-5 h-5" /></button></div>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div><label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Customer</label><input data-testid="estimate-customer-name" className={inp} value={modal.customer_name} onChange={(e) => setModal({ ...modal, customer_name: e.target.value })} /></div>
              <div><label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Customer email</label><input data-testid="estimate-customer-email" className={inp} value={modal.customer_email} onChange={(e) => setModal({ ...modal, customer_email: e.target.value })} /></div>
            </div>
            <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Line items</label>
            <div className="space-y-2 mb-3">
              {modal.line_items.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" className={inp + " flex-1"} placeholder="Item / work description (text)" value={l.desc} onChange={(e) => { const li = [...modal.line_items]; li[i] = { ...li[i], desc: e.target.value }; setModal({ ...modal, line_items: li }); }} />
                  <input className={inp + " w-16"} type="number" placeholder="Qty" value={l.qty} onChange={(e) => { const li = [...modal.line_items]; li[i] = { ...li[i], qty: e.target.value }; setModal({ ...modal, line_items: li }); }} />
                  <input className={inp + " w-24"} type="number" placeholder="Price" value={l.unit_price} onChange={(e) => { const li = [...modal.line_items]; li[i] = { ...li[i], unit_price: e.target.value }; setModal({ ...modal, line_items: li }); }} />
                  <button onClick={() => setModal({ ...modal, line_items: modal.line_items.filter((_, x) => x !== i) })} className="p-2 text-destructive"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setModal({ ...modal, line_items: [...modal.line_items, { desc: "", qty: 1, unit_price: 0 }] })} data-testid="add-line-item-btn" className="text-sm text-primary font-semibold mb-4">+ Add line item</button>

            <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Notes / Description</label>
            <textarea data-testid="estimate-notes" className={inp} rows={5} placeholder="Add scope, terms, and details — special characters welcome (e.g. $, %, &, #, /, @, °, ½)" value={modal.notes} onChange={(e) => setModal({ ...modal, notes: e.target.value })} />

            <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5 mt-4">Photos</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {modal.photos.map((p) => <div key={p} className="w-16 h-16 rounded-md border border-border overflow-hidden bg-muted flex items-center justify-center"><ImageIcon className="w-5 h-5 text-muted-foreground" /></div>)}
              <button onClick={() => fileRef.current.click()} data-testid="upload-photo-btn" className="w-16 h-16 rounded-md border border-dashed border-border flex items-center justify-center hover:bg-muted transition-colors">{uploading ? "…" : <Upload className="w-5 h-5" />}</button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
            </div>

            <div className="font-head font-extrabold text-xl mt-4 mb-4" data-testid="estimate-total">Total: ${total(modal.line_items).toLocaleString()}</div>
            <button data-testid="estimate-save-btn" onClick={save} className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-semibold">Save estimate</button>
          </div>
        </div>
      )}
    </div>
  );
}
