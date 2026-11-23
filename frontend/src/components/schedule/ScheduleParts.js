import { useState } from "react";
import { Plus, X, Users, Truck, Wrench, Pencil, Trash2, Copy, MapPin } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { toast } from "sonner";
import { PickList } from "../jobs/CrewModal";
import { ConflictDialog, checkConflicts } from "../jobs/JobExtras";
import { JOB_STATUS, JOB_STATUS_OPTIONS, jobStatusBadge } from "../../pages/Resources";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const names = (ids = [], lookup) => ids.map((i) => lookup[i]?.name).filter(Boolean);
const DOT = { scheduled: "bg-sky-500", in_progress: "bg-amber-500", completed: "bg-foreground", delayed: "bg-red-500", rescheduled: "bg-violet-500" };

export function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" data-testid="schedule-status-legend">
      {Object.entries(JOB_STATUS).map(([k, v]) => <span key={k} className="inline-flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${DOT[k]}`} />{v.label}</span>)}
    </div>
  );
}

export function MonthGrid({ start, month, selected, entries, onSelect }) {
  const today = iso(new Date());
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const cells = days.slice(0, days[35].getMonth() === month ? 42 : 35);
  return (
    <div className="border border-border rounded-md bg-card overflow-hidden mb-6" data-testid="schedule-month-grid">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">{DOW.map((d) => <div key={d} className="px-2 py-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">{d}</div>)}</div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const k = iso(d); const list = entries.filter((e) => e.date === k); const inMonth = d.getMonth() === month;
          return (
            <button key={k} onClick={() => onSelect(d)} data-testid={`month-day-${k}`}
              className={`min-h-[64px] sm:min-h-[96px] border-b border-r border-border p-1.5 text-left align-top hover:bg-muted/40 transition-colors ${inMonth ? "" : "opacity-40"} ${k === selected ? "bg-primary/10" : ""}`}>
              <div className={`text-xs font-semibold mb-1 ${k === today ? "text-primary" : ""}`}>{d.getDate()}</div>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((e) => (
                  <div key={e.id} className="hidden sm:flex items-center gap-1 text-[11px] truncate" data-testid="month-entry"><span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[e.job_status] || DOT.scheduled}`} /><span className="truncate">{e.job_name}</span></div>
                ))}
                <div className="flex sm:hidden gap-0.5 flex-wrap">{list.slice(0, 6).map((e) => <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${DOT[e.job_status] || DOT.scheduled}`} />)}</div>
                {list.length > 3 && <div className="hidden sm:block text-[10px] text-muted-foreground">+{list.length - 3} more</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WeekStrip({ days, selected, entries, onSelect }) {
  const today = iso(new Date());
  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-8" data-testid="schedule-week-strip">
      {days.map((d, i) => {
        const k = iso(d);
        const dayEntries = entries.filter((e) => e.date === k);
        const crew = dayEntries.reduce((s, e) => s + (e.employee_ids?.length || 0), 0);
        const isSel = k === selected;
        return (
          <button key={k} onClick={() => onSelect(d)} data-testid={`schedule-day-${k}`}
            className={`text-left rounded-md border p-2 sm:p-3 transition-colors ${isSel ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/40"}`}>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{DOW[i]}</span>
              <span className={`font-head font-extrabold text-lg sm:text-xl ${k === today ? "text-primary" : ""}`}>{d.getDate()}</span>
            </div>
            <div className="mt-1.5 flex gap-0.5 flex-wrap">{dayEntries.map((e) => <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${DOT[e.job_status] || DOT.scheduled}`} />)}</div>
            <div className="mt-1 hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground"><span>{dayEntries.length} job{dayEntries.length === 1 ? "" : "s"}</span><span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{crew}</span></div>
          </button>
        );
      })}
    </div>
  );
}

function Chips({ icon: Icon, items, testid }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid={testid}>
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      {items.map((n) => <span key={n} className="px-2 py-0.5 rounded-full bg-muted text-xs">{n}</span>)}
    </div>
  );
}

export function DayDetail({ date, entries, lookup, canEdit, onAdd, onEdit, onRemove, onStatus }) {
  return (
    <div data-testid="schedule-day-detail">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-head font-bold text-lg" data-testid="schedule-day-label">{date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h3>
        {canEdit && (
          <button onClick={onAdd} data-testid="schedule-add-btn" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"><Plus className="w-4 h-4" /> Schedule job</button>
        )}
      </div>
      {entries.length === 0 && <div className="border border-dashed border-border rounded-md p-12 text-center text-muted-foreground" data-testid="schedule-empty">Nothing scheduled for this day.</div>}
      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e.id} className="border border-border rounded-md bg-card p-4 sm:p-5" data-testid="schedule-entry">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><span className="font-head font-bold text-lg" data-testid="schedule-entry-name">{e.job_name}</span>{jobStatusBadge(e.job_status)}{e.auto && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">auto</span>}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">{e.customer_name}{e.address ? <><MapPin className="w-3 h-3 ml-1" />{e.address}</> : null}</div>
              </div>
              {canEdit && (
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => onEdit(e)} data-testid="schedule-edit-btn" className="p-2 rounded hover:bg-muted"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => onRemove(e.id)} data-testid="schedule-remove-btn" className="p-2 rounded hover:bg-muted text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
            <div className="mt-3 space-y-2">
              <Chips icon={Users} items={names(e.employee_ids, lookup)} testid="schedule-entry-crew" />
              <Chips icon={Truck} items={names(e.vehicle_ids, lookup)} testid="schedule-entry-vehicles" />
              <Chips icon={Wrench} items={names(e.equipment_ids, lookup)} testid="schedule-entry-equipment" />
              {e.notes && <div className="text-sm text-muted-foreground pt-1">{e.notes}</div>}
            </div>
            {canEdit && (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Status</span>
                <select value={e.job_status} onChange={(ev) => onStatus(e.job_id, ev.target.value)} data-testid="schedule-status-select"
                  className="px-2 py-1.5 rounded-md border border-border bg-background text-xs font-medium">
                  {JOB_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const inp = "w-full px-3 py-3 sm:py-2 rounded-md border border-input bg-background text-base sm:text-sm focus:ring-2 focus:ring-primary focus:outline-none";
const lbl = "block text-xs uppercase tracking-wider text-muted-foreground mb-1.5";

export function ScheduleModal({ entry, jobs, res, onClose, onSaved }) {
  const [form, setForm] = useState({
    id: entry.id, date: entry.date, job_id: entry.job_id || "", notes: entry.notes || "",
    employee_ids: entry.employee_ids || [], vehicle_ids: entry.vehicle_ids || [], equipment_ids: entry.equipment_ids || [],
  });
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState(null);
  const job = jobs.find((j) => j.id === form.job_id);
  const toggle = (key, id) => setForm((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }));
  const useJobCrew = () => job && setForm((f) => ({ ...f, employee_ids: job.assigned_employees || [], vehicle_ids: job.assigned_vehicles || [], equipment_ids: job.assigned_equipment || [] }));

  const commit = async () => {
    setSaving(true);
    try { await api.put("/schedule", form); toast.success("Schedule saved"); onSaved(); }
    catch (e) { toast.error(errMsg(e)); }
    setSaving(false);
  };
  const save = async () => {
    if (!form.job_id) { toast.error("Pick a job"); return; }
    const added = form.employee_ids.filter((id) => !(entry.employee_ids || []).includes(id));
    try {
      const found = await checkConflicts([form.date], added, form.job_id);
      if (found.length) { setConflicts(found); return; }
    } catch (e) { toast.error(errMsg(e)); return; }
    commit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-t-2xl sm:rounded-md w-full sm:max-w-xl max-h-[92vh] overflow-y-auto p-5 sm:p-6" data-testid="schedule-modal">
        <div className="flex items-center justify-between mb-6"><h2 className="font-head font-bold text-xl">{entry.id ? "Edit" : "Schedule"} job</h2><button onClick={onClose} aria-label="Close" className="p-2"><X className="w-5 h-5" /></button></div>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div><label className={lbl}>Date</label><input type="date" data-testid="schedule-date" className={inp} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div><label className={lbl}>Job</label>
            <select data-testid="schedule-job" className={inp} value={form.job_id} disabled={!!entry.id} onChange={(e) => setForm({ ...form, job_id: e.target.value })}>
              <option value="">Select job…</option>
              {jobs.filter((j) => j.status !== "completed").map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          </div>
        </div>
        {job && (job.assigned_employees?.length || job.assigned_vehicles?.length || job.assigned_equipment?.length) ? (
          <button onClick={useJobCrew} data-testid="schedule-use-job-crew" className="inline-flex items-center gap-2 text-sm text-primary font-semibold mb-4"><Copy className="w-4 h-4" /> Use this job's assigned crew</button>
        ) : null}
        <div className="space-y-5">
          <div><div className={lbl}>Crew ({form.employee_ids.length})</div><PickList items={res.employees} selected={form.employee_ids} onToggle={(id) => toggle("employee_ids", id)} testid="schedule-pick-employees" /></div>
          <div><div className={lbl}>Vehicles ({form.vehicle_ids.length})</div><PickList items={res.vehicles} selected={form.vehicle_ids} onToggle={(id) => toggle("vehicle_ids", id)} testid="schedule-pick-vehicles" /></div>
          <div><div className={lbl}>Equipment ({form.equipment_ids.length})</div><PickList items={res.equipment} selected={form.equipment_ids} onToggle={(id) => toggle("equipment_ids", id)} testid="schedule-pick-equipment" /></div>
          <div><label className={lbl}>Notes</label><textarea data-testid="schedule-notes" rows={2} className={inp} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Start time, gate code, materials to bring…" /></div>
        </div>
        <button onClick={save} disabled={saving} data-testid="schedule-save-btn" className="w-full mt-6 py-3 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
      </div>
      {conflicts && <ConflictDialog conflicts={conflicts} onCancel={() => setConflicts(null)} onProceed={() => { setConflicts(null); commit(); }} />}
    </div>
  );
}
