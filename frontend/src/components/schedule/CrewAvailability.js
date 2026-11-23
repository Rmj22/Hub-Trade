import { useEffect, useMemo, useState } from "react";
import { api, errMsg } from "../../lib/api";
import { toast } from "sonner";
import { Users } from "lucide-react";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DOT = { scheduled: "bg-sky-500", in_progress: "bg-amber-500", completed: "bg-foreground", delayed: "bg-red-500", rescheduled: "bg-violet-500" };

export function useWeekEntries(days) {
  const [entries, setEntries] = useState([]);
  const start = days[0] ? iso(days[0]) : null, end = days[6] ? iso(days[6]) : null;
  useEffect(() => {
    if (!start) return;
    api.get("/schedule", { params: { start, end } }).then((r) => setEntries(r.data)).catch((e) => toast.error(errMsg(e)));
  }, [start, end]);
  return entries;
}

export function CrewAvailability({ days, employees, entries, highlightDates = [], onPick, selected = [] }) {
  const today = iso(new Date());
  const byEmp = useMemo(() => {
    const m = {};
    entries.forEach((e) => (e.employee_ids || []).forEach((id) => { (m[id] ||= {})[e.date] = [...((m[id] || {})[e.date] || []), e]; }));
    return m;
  }, [entries]);
  if (employees.length === 0) return <div className="text-xs text-muted-foreground py-2">No employees yet.</div>;
  return (
    <div className="border border-border rounded-md bg-card overflow-hidden" data-testid="crew-availability">
      <div className="grid grid-cols-[minmax(96px,1.4fr)_repeat(7,1fr)] text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border">
        <div className="px-3 py-2 inline-flex items-center gap-1"><Users className="w-3 h-3" /> Crew</div>
        {days.map((d, i) => { const k = iso(d); return <div key={k} className={`py-2 text-center ${k === today ? "text-primary" : ""} ${highlightDates.includes(k) ? "bg-primary/10" : ""}`}>{DOW[i]}<div className="font-head font-bold text-xs text-foreground">{d.getDate()}</div></div>; })}
      </div>
      {employees.map((emp) => {
        const row = byEmp[emp.id] || {};
        const busyDays = Object.keys(row).length;
        return (
          <div key={emp.id} className={`grid grid-cols-[minmax(96px,1.4fr)_repeat(7,1fr)] border-b border-border last:border-0 text-xs ${selected.includes(emp.id) ? "bg-primary/5" : ""}`} data-testid={`availability-row-${emp.id}`}>
            <button type="button" onClick={() => onPick?.(emp.id)} className="px-3 py-2 text-left min-w-0 hover:bg-muted/40" data-testid={`availability-pick-${emp.id}`}>
              <div className="font-medium truncate">{emp.name}</div>
              <div className="text-[10px] text-muted-foreground">{7 - busyDays} free · {busyDays} busy</div>
            </button>
            {days.map((d) => {
              const k = iso(d); const list = row[k] || []; const hl = highlightDates.includes(k);
              return (
                <div key={k} title={list.map((e) => e.job_name).join(", ")} data-testid={`availability-cell-${emp.id}-${k}`} data-busy={list.length > 0}
                  className={`flex items-center justify-center py-2 border-l border-border ${hl ? "bg-primary/10" : ""}`}>
                  {list.length === 0 ? <span className="w-5 h-5 rounded-full border border-dashed border-green-500/60" aria-label="Free" />
                    : <span className="flex gap-0.5">{list.slice(0, 3).map((e) => <span key={e.id} className={`w-2.5 h-2.5 rounded-full ${DOT[e.job_status] || DOT.scheduled}`} />)}</span>}
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="px-3 py-2 text-[10px] text-muted-foreground flex gap-3 flex-wrap border-t border-border"><span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full border border-dashed border-green-500/60" /> Free</span><span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Scheduled on a job</span>{highlightDates.length > 0 && <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary/20" /> This job's dates</span>}</div>
    </div>
  );
}
