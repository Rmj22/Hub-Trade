import { useEffect, useState } from "react";
import { X, Users, Truck, Wrench } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { toast } from "sonner";

const GROUPS = [
  { key: "assigned_employees", label: "Crew", icon: Users, src: "employees" },
  { key: "assigned_vehicles", label: "Vehicles", icon: Truck, src: "vehicles" },
  { key: "assigned_equipment", label: "Equipment", icon: Wrench, src: "equipment" },
];

export function useResources() {
  const [res, setRes] = useState({ employees: [], vehicles: [], equipment: [] });
  useEffect(() => {
    Promise.all(["employees", "vehicles", "equipment"].map((r) => api.get(`/${r}`)))
      .then(([e, v, q]) => setRes({ employees: e.data, vehicles: v.data, equipment: q.data }))
      .catch((e) => toast.error(errMsg(e)));
  }, []);
  return res;
}

export function PickList({ items, selected, onToggle, testid }) {
  if (items.length === 0) return <div className="text-xs text-muted-foreground py-2">None added yet.</div>;
  return (
    <div className="flex flex-wrap gap-2" data-testid={testid}>
      {items.map((it) => {
        const on = selected.includes(it.id);
        return (
          <button key={it.id} type="button" onClick={() => onToggle(it.id)} data-testid={`${testid}-${it.id}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
            {it.name}{it.plate ? ` · ${it.plate}` : ""}
          </button>
        );
      })}
    </div>
  );
}

export function CrewModal({ job, onClose, onSaved }) {
  const res = useResources();
  const [sel, setSel] = useState({
    assigned_employees: job.assigned_employees || [],
    assigned_vehicles: job.assigned_vehicles || [],
    assigned_equipment: job.assigned_equipment || [],
  });
  const [saving, setSaving] = useState(false);

  const toggle = (key, id) => setSel((s) => ({ ...s, [key]: s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id] }));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/jobs/${job.id}/crew`, sel);
      toast.success("Crew updated"); onSaved(data); onClose();
    } catch (e) { toast.error(errMsg(e)); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-md w-full max-w-xl max-h-[90vh] overflow-y-auto p-6" data-testid="crew-modal">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-head font-bold text-xl">Assign crew</h2>
          <button onClick={onClose} data-testid="crew-close-btn"><X className="w-5 h-5" /></button>
        </div>
        <div className="text-sm text-muted-foreground mb-6">{job.name}{job.customer_name ? ` · ${job.customer_name}` : ""}</div>
        <div className="space-y-6">
          {GROUPS.map((g) => (
            <div key={g.key}>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2"><g.icon className="w-3.5 h-3.5" /> {g.label} <span className="text-primary">({sel[g.key].length})</span></div>
              <PickList items={res[g.src]} selected={sel[g.key]} onToggle={(id) => toggle(g.key, id)} testid={`crew-pick-${g.src}`} />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={save} disabled={saving} data-testid="crew-save-btn" className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-60">{saving ? "Saving…" : "Save crew"}</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-md border border-border hover:bg-muted">Cancel</button>
        </div>
      </div>
    </div>
  );
}
