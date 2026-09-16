import { X, Send, Trash2, Upload, Image as ImageIcon } from "lucide-react";

const inp = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none";
const lbl = "block text-xs uppercase tracking-wider text-muted-foreground mb-1.5";

export const lineTotal = (li) => li.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);

export function EstimateCard({ e, onEdit, onSend, onDelete }) {
  return (
    <div className="border border-border rounded-md bg-card p-5" data-testid="estimate-card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-head font-bold">{e.customer_name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.status === "sent" ? "bg-green-500/15 text-green-500" : "bg-muted text-muted-foreground"}`}>{e.status}</span>
      </div>
      <div className="text-xs text-muted-foreground mb-3">{e.customer_email || "no email"}</div>
      <div className="font-head font-extrabold text-2xl mb-1">${(e.total || 0).toLocaleString()}</div>
      <div className="text-xs text-muted-foreground mb-4">{e.line_items?.length || 0} line items · {e.photos?.length || 0} photos</div>
      <div className="flex gap-2">
        <button onClick={() => onEdit(e)} data-testid="estimate-edit-btn" className="flex-1 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors">Edit</button>
        <button onClick={() => onSend(e.id)} data-testid="estimate-send-btn" className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-1"><Send className="w-3.5 h-3.5" /> Send</button>
        <button onClick={() => onDelete(e.id)} data-testid="estimate-delete-btn" className="p-2 rounded-md border border-border text-destructive hover:bg-muted transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

export function LineItemsEditor({ items, onChange, newLine }) {
  const update = (i, patch) => onChange(items.map((l, x) => (x === i ? { ...l, ...patch } : l)));
  return (
    <>
      <label className={lbl}>Line items</label>
      <div className="space-y-2 mb-3">
        {items.map((l, i) => (
          <div key={l._key} className="flex gap-2">
            <input type="text" className={inp + " flex-1"} placeholder="Item / work description (text)" value={l.desc} onChange={(e) => update(i, { desc: e.target.value })} />
            <input className={inp + " w-16"} type="number" placeholder="Qty" value={l.qty} onChange={(e) => update(i, { qty: e.target.value })} />
            <input className={inp + " w-24"} type="number" placeholder="Price" value={l.unit_price} onChange={(e) => update(i, { unit_price: e.target.value })} />
            <button onClick={() => onChange(items.filter((_, x) => x !== i))} className="p-2 text-destructive"><X className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <button onClick={() => onChange([...items, newLine()])} data-testid="add-line-item-btn" className="text-sm text-primary font-semibold mb-4">+ Add line item</button>
    </>
  );
}

export function EstimateModal({ modal, setModal, editing, onSave, onClose, onUpload, uploading, fileRef, newLine }) {
  const set = (patch) => setModal({ ...modal, ...patch });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-md w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" data-testid="estimate-modal">
        <div className="flex items-center justify-between mb-6"><h2 className="font-head font-bold text-xl">{editing ? "Edit" : "New"} estimate</h2><button onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div><label className={lbl}>Customer</label><input data-testid="estimate-customer-name" className={inp} value={modal.customer_name} onChange={(e) => set({ customer_name: e.target.value })} /></div>
          <div><label className={lbl}>Customer email</label><input data-testid="estimate-customer-email" className={inp} value={modal.customer_email} onChange={(e) => set({ customer_email: e.target.value })} /></div>
        </div>
        <LineItemsEditor items={modal.line_items} onChange={(li) => set({ line_items: li })} newLine={newLine} />

        <label className={lbl}>Notes / Description</label>
        <textarea data-testid="estimate-notes" className={inp} rows={5} placeholder="Add scope, terms, and details — special characters welcome (e.g. $, %, &, #, /, @, °, ½)" value={modal.notes} onChange={(e) => set({ notes: e.target.value })} />

        <label className={lbl + " mt-4"}>Photos</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {modal.photos.map((p) => <div key={p} className="w-16 h-16 rounded-md border border-border overflow-hidden bg-muted flex items-center justify-center"><ImageIcon className="w-5 h-5 text-muted-foreground" /></div>)}
          <button onClick={() => fileRef.current.click()} data-testid="upload-photo-btn" className="w-16 h-16 rounded-md border border-dashed border-border flex items-center justify-center hover:bg-muted transition-colors">{uploading ? "…" : <Upload className="w-5 h-5" />}</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
        </div>

        <div className="font-head font-extrabold text-xl mt-4 mb-4" data-testid="estimate-total">Total: ${lineTotal(modal.line_items).toLocaleString()}</div>
        <button data-testid="estimate-save-btn" onClick={onSave} className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-semibold">Save estimate</button>
      </div>
    </div>
  );
}
