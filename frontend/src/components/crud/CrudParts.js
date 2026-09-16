import { Pencil, Trash2, X } from "lucide-react";

const INPUT_TYPES = { number: "number", date: "date" };
const base = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none";

export function Field({ f, value, onChange }) {
  if (f.type === "select")
    return (
      <select data-testid={`field-${f.key}`} className={base} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
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

export function CrudTable({ items, columns, canWrite, isOwner, testid, onEdit, onDelete, renderExtra, reload }) {
  return (
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
                    <button onClick={() => onEdit(it)} data-testid={`${testid}-edit-btn`} className="p-1.5 rounded hover:bg-muted transition-colors"><Pencil className="w-4 h-4" /></button>
                    {isOwner && <button onClick={() => onDelete(it.id)} data-testid={`${testid}-delete-btn`} className="p-1.5 rounded hover:bg-muted text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>}
                    {renderExtra && renderExtra(it, reload)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CrudModal({ title, singular, editing, fields, form, setForm, onSave, onClose, testid }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" data-testid={`${testid}-modal`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-head font-bold text-xl">{editing ? "Edit" : "New"} {singular}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">{f.label}</label>
              <Field f={f} value={form[f.key]} onChange={(v) => setForm((m) => ({ ...m, [f.key]: v }))} />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onSave} data-testid={`${testid}-save-btn`} className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">Save</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-md border border-border hover:bg-muted transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}
