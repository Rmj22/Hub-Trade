import { Pencil, Trash2, X } from "lucide-react";

const INPUT_TYPES = { number: "number", date: "date" };
const base = "w-full px-3 py-3 sm:py-2 rounded-md border border-input bg-background text-base sm:text-sm focus:ring-2 focus:ring-primary focus:outline-none";
const iconBtn = "p-2.5 sm:p-1.5 rounded-md hover:bg-muted transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center";

export const visibleFields = (fields, form) => fields.filter((f) => !f.showIf || f.showIf(form));

export function Field({ f, value, onChange }) {
  if (f.type === "select")
    return (
      <select data-testid={`field-${f.key}`} className={base} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        {f.options.map((o) => { const v = typeof o === "string" ? o : o.value; const l = typeof o === "string" ? o : o.label; return <option key={v} value={v}>{l}</option>; })}
      </select>
    );
  if (f.type === "textarea")
    return <textarea data-testid={`field-${f.key}`} className={base} rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  const handleChange = (e) => {
    const raw = e.target.value;
    if (f.type !== "number") return onChange(raw);
    onChange(raw === "" ? "" : Number(raw));
  };
  return <input data-testid={`field-${f.key}`} type={INPUT_TYPES[f.type] || "text"} className={base} value={value ?? ""} onChange={handleChange} />;
}

function RowActions({ it, canWrite, writable, isOwner, testid, onEdit, onDelete, renderExtra, reload }) {
  if (!canWrite && !renderExtra) return null;
  return (
    <div className="flex items-center justify-end gap-1">
      {writable && <button onClick={() => onEdit(it)} data-testid={`${testid}-edit-btn`} className={iconBtn}><Pencil className="w-4 h-4" /></button>}
      {writable && isOwner && <button onClick={() => onDelete(it.id)} data-testid={`${testid}-delete-btn`} className={`${iconBtn} text-destructive`}><Trash2 className="w-4 h-4" /></button>}
      {renderExtra && renderExtra(it, reload)}
    </div>
  );
}

const cell = (c, it) => (c.render ? c.render(it) : String(it[c.key] ?? "—"));

export function CrudTable({ items, columns, canWrite, writable = true, isOwner, testid, onEdit, onDelete, renderExtra, reload }) {
  const actions = { canWrite, writable, isOwner, testid, onEdit, onDelete, renderExtra, reload };
  return (
    <>
      <div className="md:hidden space-y-3" data-testid={`${testid}-cards`}>
        {items.map((it) => (
          <div key={it.id} className="border border-border rounded-md bg-card p-4" data-testid={`${testid}-row`}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="font-head font-bold text-base break-words min-w-0">{cell(columns[0], it)}</div>
              <RowActions it={it} {...actions} />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {columns.slice(1).map((c) => (
                <div key={c.key} className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</dt>
                  <dd className="break-words">{cell(c, it)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <div className="hidden md:block border border-border rounded-md overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {columns.map((c) => <th key={c.key} className="text-left font-semibold px-4 py-3 whitespace-nowrap">{c.label}</th>)}
                {(canWrite || renderExtra) && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid={`${testid}-row`}>
                  {columns.map((c) => <td key={c.key} className="px-4 py-3 whitespace-nowrap">{cell(c, it)}</td>)}
                  {(canWrite || renderExtra) && <td className="px-4 py-3 text-right whitespace-nowrap"><RowActions it={it} {...actions} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function ModalShell({ title, onClose, children, testid, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative bg-card border border-border rounded-t-2xl sm:rounded-md w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} max-h-[92vh] sm:max-h-[90vh] overflow-y-auto p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]`} data-testid={testid}>
        <div className="sm:hidden w-10 h-1 rounded-full bg-muted mx-auto mb-3" />
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-head font-bold text-xl">{title}</h2>
          <button onClick={onClose} aria-label="Close" className={iconBtn}><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CrudModal({ singular, editing, fields, form, setForm, onSave, onClose, testid }) {
  return (
    <ModalShell title={`${editing ? "Edit" : "New"} ${singular}`} onClose={onClose} testid={`${testid}-modal`}>
      <div className="space-y-4">
        {visibleFields(fields, form).map((f) => (
          <div key={f.key}>
            <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">{f.label}</label>
            <Field f={f} value={form[f.key]} onChange={(v) => setForm((m) => ({ ...m, [f.key]: v }))} />
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onSave} data-testid={`${testid}-save-btn`} className="flex-1 py-3 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">Save</button>
        <button onClick={onClose} className="px-5 py-3 rounded-md border border-border hover:bg-muted transition-colors">Cancel</button>
      </div>
    </ModalShell>
  );
}
