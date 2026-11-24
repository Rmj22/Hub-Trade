import { useState } from "react";
import { AlertTriangle, CalendarPlus, X } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { toast } from "sonner";
import { ModalShell } from "../crud/CrudParts";

export function ConflictDialog({ conflicts, onCancel, onProceed }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" data-testid="conflict-dialog">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative bg-card border border-amber-500/40 rounded-t-2xl sm:rounded-md w-full sm:max-w-md max-h-[92vh] overflow-y-auto p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-2 text-amber-500"><AlertTriangle className="w-5 h-5" /><h3 className="font-head font-bold text-lg text-foreground">Scheduling conflict</h3></div>
        <p className="text-sm text-muted-foreground mb-4">These crew members are already scheduled on another job for the same day. Review before continuing — nothing has been saved yet.</p>
        <ul className="space-y-2 mb-5">
          {conflicts.map((c) => (
            <li key={`${c.employee_id}-${c.job_id}-${c.date}`} className="text-sm border border-border rounded-md px-3 py-2" data-testid="conflict-row">
              <span className="font-semibold">{c.employee_name}</span> · <span className="text-muted-foreground">{c.date}</span>
              <div className="text-xs text-muted-foreground">Already on <span className="text-foreground font-medium">{c.job_name}</span></div>
            </li>
          ))}
        </ul>
        <div className="flex gap-3">
          <button onClick={onCancel} data-testid="conflict-cancel-btn" className="flex-1 py-3 rounded-md border border-border font-semibold hover:bg-muted">Cancel</button>
          <button onClick={onProceed} data-testid="conflict-proceed-btn" className="flex-1 py-3 rounded-md bg-amber-500 text-black font-semibold hover:opacity-90">Proceed anyway</button>
        </div>
      </div>
    </div>
  );
}

export async function checkConflicts(dates, employeeIds, excludeJobId) {
  if (!dates.length || !employeeIds.length) return [];
  const { data } = await api.post("/schedule/conflicts", { dates, employee_ids: employeeIds, exclude_job_id: excludeJobId || null });
  return data;
}

export function JobDatesModal({ job, onClose, onSaved }) {
  const [dates, setDates] = useState(job.work_dates || []);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const add = () => {
    if (!draft) return;
    if (draft === job.start_date) { toast.error("That's already the start date"); return; }
    if (dates.includes(draft)) { toast.error("Date already added"); return; }
    setDates([...dates, draft].sort()); setDraft("");
  };
  const save = async () => {
    setSaving(true);
    try { const { data } = await api.put(`/jobs/${job.id}/dates`, { work_dates: dates }); toast.success("Work dates saved"); onSaved(data); onClose(); }
    catch (e) { toast.error(errMsg(e)); }
    setSaving(false);
  };
  return (
    <ModalShell title="Work dates" onClose={onClose} testid="job-dates-modal">
      <div className="text-sm text-muted-foreground mb-4">{job.name} · start date <span className="font-semibold text-foreground">{job.start_date || "not set"}</span> (kept as-is)</div>
      <div className="flex gap-2 mb-4">
        <input type="date" data-testid="job-dates-input" value={draft} onChange={(e) => setDraft(e.target.value)} className="flex-1 min-w-0 px-3 py-3 sm:py-2 rounded-md border border-input bg-background text-base sm:text-sm" />
        <button onClick={add} data-testid="job-dates-add-btn" className="px-4 rounded-md bg-primary text-primary-foreground font-semibold inline-flex items-center gap-1"><CalendarPlus className="w-4 h-4" /> Add</button>
      </div>
      {dates.length === 0 ? <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-6 text-center" data-testid="job-dates-empty">No extra work days yet.</div> : (
        <ul className="space-y-2" data-testid="job-dates-list">
          {dates.map((d) => (
            <li key={d} className="flex items-center justify-between border border-border rounded-md px-3 py-2 text-sm" data-testid="job-date-row">
              <span>{new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
              <button onClick={() => setDates(dates.filter((x) => x !== d))} data-testid="job-date-remove-btn" aria-label="Remove date" className="p-2 text-destructive"><X className="w-4 h-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <button onClick={save} disabled={saving} data-testid="job-dates-save-btn" className="w-full mt-6 py-3 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-60">{saving ? "Saving…" : "Save dates"}</button>
    </ModalShell>
  );
}
