import { X, Send, Trash2, Upload, Image as ImageIcon, FileDown } from "lucide-react";
import { API } from "../../lib/api";
import { ModalShell } from "../crud/CrudParts";

const inp = "w-full px-3 py-3 sm:py-2 rounded-md border border-input bg-background text-base sm:text-sm focus:ring-2 focus:ring-primary focus:outline-none";
const lbl = "block text-xs uppercase tracking-wider text-muted-foreground mb-1.5";

const STATUS_CLS = { sent: "bg-blue-500/15 text-blue-500", approved: "bg-green-500/15 text-green-500" };
export const SECTIONS = [
  { key: "materials", label: "Materials" },
  { key: "labor", label: "Labor" },
  { key: "services", label: "Services" },
];

export const lineTotal = (li) => li.reduce((s, l) => s + (Number(l.qty) || 1) * (Number(l.unit_price) || 0), 0);
const money = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function buildSchedule(total, start, n) {
  n = Math.max(1, Math.min(Number(n) || 1, 12));
  const base = start ? new Date(`${start}T00:00:00`) : new Date();
  const per = Math.round((total / n) * 100) / 100;
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    d.setDate(Math.min(base.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    const amount = i === n - 1 ? Math.round((total - per * (n - 1)) * 100) / 100 : per;
    return { label: i === 0 ? "Deposit" : `Payment ${i + 1}`, amount, due_date: fmt(d) };
  });
}

export function EstimateCard({ e, onEdit, onSend, onDelete }) {
  return (
    <div className="border border-border rounded-md bg-card p-5" data-testid="estimate-card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-head font-bold">{e.customer_name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[e.status] || "bg-muted text-muted-foreground"}`} data-testid="estimate-status">{e.deposit_paid ? "deposit paid" : e.status}</span>
      </div>
      <div className="text-xs text-muted-foreground mb-3">{e.customer_email || "no email"}</div>
      <div className="font-head font-extrabold text-2xl mb-1">{money(e.total)}</div>
      <div className="text-xs text-muted-foreground mb-4">{e.line_items?.length || 0} items · {e.payment_schedule?.length || 1} payment{(e.payment_schedule?.length || 1) > 1 ? "s" : ""}{e.job_start_date ? ` · starts ${e.job_start_date}` : ""}{e.signature_name ? ` · signed by ${e.signature_name}` : ""}</div>
      <div className="flex gap-2">
        <button onClick={() => onEdit(e)} data-testid="estimate-edit-btn" className="flex-1 py-2.5 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors">Edit</button>
        <button onClick={() => onSend(e.id)} data-testid="estimate-send-btn" className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-1"><Send className="w-3.5 h-3.5" /> Send</button>
        <a href={`${API}/estimates/${e.id}/pdf`} target="_blank" rel="noreferrer" data-testid="estimate-pdf-btn" title="Download PDF" className="p-2.5 rounded-md border border-border hover:bg-muted transition-colors"><FileDown className="w-4 h-4" /></a>
        <button onClick={() => onDelete(e.id)} data-testid="estimate-delete-btn" className="p-2.5 rounded-md border border-border text-destructive hover:bg-muted transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function SectionEditor({ section, items, onChange, newLine }) {
  const mine = items.filter((l) => l.section === section.key);
  const update = (key, patch) => onChange(items.map((l) => (l._key === key ? { ...l, ...patch } : l)));
  return (
    <div className="mb-4" data-testid={`estimate-section-${section.key}`}>
      <div className="flex items-center justify-between mb-2">
        <label className={lbl + " mb-0"}>{section.label}</label>
        <span className="text-xs text-muted-foreground">{money(lineTotal(mine))}</span>
      </div>
      <div className="space-y-2">
        {mine.map((l) => (
          <div key={l._key} className="flex gap-2">
            <input type="text" className={inp + " flex-1 min-w-0"} placeholder="Description" data-testid={`line-desc-${section.key}`} value={l.desc} onChange={(e) => update(l._key, { desc: e.target.value })} />
            <input className={inp.replace("w-full ", "") + " w-20 sm:w-28 shrink-0"} type="number" inputMode="decimal" placeholder="$" data-testid={`line-price-${section.key}`} value={l.unit_price} onChange={(e) => update(l._key, { unit_price: e.target.value })} />
            <button onClick={() => onChange(items.filter((x) => x._key !== l._key))} aria-label="Remove" className="p-2 text-destructive shrink-0 inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <button onClick={() => onChange([...items, newLine(section.key)])} data-testid={`add-line-${section.key}`} className="text-sm text-primary font-semibold mt-2 py-2">+ Add {section.label.toLowerCase()} item</button>
    </div>
  );
}

export function PaymentSchedule({ rows }) {
  return (
    <div className="border border-border rounded-md overflow-hidden" data-testid="payment-schedule">
      {rows.map((r, i) => (
        <div key={r.label} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i > 0 ? "border-t border-border" : ""}`}>
          <div><div className="font-medium">{r.label}</div><div className="text-xs text-muted-foreground">Due {r.due_date}</div></div>
          <div className="font-head font-bold">{money(r.amount)}</div>
        </div>
      ))}
    </div>
  );
}

export function EstimateModal({ modal, setModal, editing, onSave, onClose, onUpload, uploading, fileRef, newLine }) {
  const set = (patch) => setModal({ ...modal, ...patch });
  const total = lineTotal(modal.line_items);
  const schedule = buildSchedule(total, modal.job_start_date, modal.num_payments);
  return (
    <ModalShell title={`${editing ? "Edit" : "New"} estimate`} onClose={onClose} testid="estimate-modal" wide>
      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        <div><label className={lbl}>Customer</label><input data-testid="estimate-customer-name" className={inp} value={modal.customer_name} onChange={(e) => set({ customer_name: e.target.value })} /></div>
        <div><label className={lbl}>Customer email</label><input data-testid="estimate-customer-email" type="email" className={inp} value={modal.customer_email} onChange={(e) => set({ customer_email: e.target.value })} /></div>
      </div>

      {SECTIONS.map((s) => <SectionEditor key={s.key} section={s} items={modal.line_items} onChange={(li) => set({ line_items: li })} newLine={newLine} />)}

      <div className="flex items-center justify-between border-t border-border pt-4 mb-5">
        <span className="text-sm uppercase tracking-wider text-muted-foreground">Total cost</span>
        <span className="font-head font-extrabold text-2xl" data-testid="estimate-total">{money(total)}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div><label className={lbl}>Job start date</label><input data-testid="estimate-start-date" type="date" className={inp} value={modal.job_start_date || ""} onChange={(e) => set({ job_start_date: e.target.value })} /></div>
        <div><label className={lbl}>Number of payments</label><input data-testid="estimate-num-payments" type="number" inputMode="numeric" min="1" max="12" className={inp} value={modal.num_payments} onChange={(e) => set({ num_payments: e.target.value === "" ? "" : Number(e.target.value) })} /></div>
      </div>
      <label className={lbl}>Deposit payment schedule</label>
      <div className="mb-5"><PaymentSchedule rows={schedule} /></div>

      <label className={lbl}>Notes / Description</label>
      <textarea data-testid="estimate-notes" className={inp} rows={4} placeholder="Scope, terms and details" value={modal.notes} onChange={(e) => set({ notes: e.target.value })} />

      <label className={lbl + " mt-4"}>Photos</label>
      <div className="flex flex-wrap gap-2 mb-5">
        {modal.photos.map((p) => <div key={p} className="w-16 h-16 rounded-md border border-border overflow-hidden bg-muted flex items-center justify-center"><ImageIcon className="w-5 h-5 text-muted-foreground" /></div>)}
        <button onClick={() => fileRef.current.click()} data-testid="upload-photo-btn" className="w-16 h-16 rounded-md border border-dashed border-border flex items-center justify-center hover:bg-muted transition-colors">{uploading ? "…" : <Upload className="w-5 h-5" />}</button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
      </div>

      <button data-testid="estimate-save-btn" onClick={onSave} className="w-full py-3 rounded-md bg-primary text-primary-foreground font-semibold">Save estimate</button>
    </ModalShell>
  );
}
