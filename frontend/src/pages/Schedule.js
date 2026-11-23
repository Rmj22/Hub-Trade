import { useEffect, useState, useCallback, useMemo } from "react";
import { api, errMsg } from "../lib/api";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useResources } from "../components/jobs/CrewModal";
import { WeekStrip, DayDetail, ScheduleModal, MonthGrid, StatusLegend } from "../components/schedule/ScheduleParts";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d, n) => { const x = new Date(d); x.setDate(1); x.setMonth(x.getMonth() + n); return x; };
const startOfWeek = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const VIEWS = [["month", "Monthly"], ["week", "Weekly"], ["day", "Daily"]];

function range(view, day) {
  if (view === "day") return [day, day];
  if (view === "week") { const s = startOfWeek(day); return [s, addDays(s, 6)]; }
  const first = new Date(day.getFullYear(), day.getMonth(), 1);
  const last = new Date(day.getFullYear(), day.getMonth() + 1, 0);
  return [startOfWeek(first), addDays(startOfWeek(last), 6)];
}

export default function SchedulePage() {
  const { user } = useAuth();
  const res = useResources();
  const [jobs, setJobs] = useState([]);
  const [view, setView] = useState(() => localStorage.getItem("ht_schedule_view") || "week");
  const [day, setDay] = useState(() => new Date(new Date().setHours(12, 0, 0, 0)));
  const [entries, setEntries] = useState([]);
  const [modal, setModal] = useState(null);
  const canEdit = user?.role !== "employee";

  const [rangeStart, rangeEnd] = useMemo(() => range(view, day), [view, day]);
  const weekDays = useMemo(() => { const s = startOfWeek(day); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); }, [day]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/schedule", { params: { start: iso(rangeStart), end: iso(rangeEnd) } });
      setEntries(data);
    } catch (e) { toast.error(errMsg(e)); }
  }, [rangeStart, rangeEnd]);
  const loadJobs = useCallback(() => api.get("/jobs").then((r) => setJobs(r.data)).catch((e) => toast.error(errMsg(e))), []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadJobs(); }, [loadJobs]);
  useEffect(() => { localStorage.setItem("ht_schedule_view", view); }, [view]);

  const lookup = useMemo(() => {
    const m = {};
    [...res.employees, ...res.vehicles, ...res.equipment, ...jobs].forEach((x) => { m[x.id] = x; });
    return m;
  }, [res, jobs]);

  const dayEntries = entries.filter((e) => e.date === iso(day));
  const step = (n) => setDay(view === "month" ? addMonths(day, n) : addDays(day, view === "week" ? 7 * n : n));
  const title = view === "month"
    ? day.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : view === "week" ? `${weekDays[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      : day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const remove = async (id) => {
    try { await api.delete(`/schedule/${id}`); toast.success("Removed from schedule"); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const setStatus = async (jobId, status) => {
    try { await api.put(`/jobs/${jobId}`, { status }); toast.success("Status updated"); load(); loadJobs(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div data-testid="schedule-page">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Plan the work</div>
          <h1 className="font-head font-extrabold text-3xl sm:text-4xl tracking-tight">Schedule</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={view} onChange={(e) => setView(e.target.value)} data-testid="schedule-view-select"
            className="px-3 py-2 rounded-md border border-border bg-card text-sm font-semibold focus:ring-2 focus:ring-primary focus:outline-none">
            {VIEWS.map(([v, l]) => <option key={v} value={v}>{l} View</option>)}
          </select>
          <button onClick={() => step(-1)} data-testid="schedule-prev" className="p-2 rounded-md border border-border hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setDay(new Date(new Date().setHours(12, 0, 0, 0)))} data-testid="schedule-today" className="px-3 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted inline-flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Today</button>
          <button onClick={() => step(1)} data-testid="schedule-next" className="p-2 rounded-md border border-border hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="font-head font-bold text-xl" data-testid="schedule-range-title">{title}</h2>
        <StatusLegend />
      </div>

      {view === "month" && <MonthGrid start={rangeStart} month={day.getMonth()} selected={iso(day)} entries={entries} onSelect={(d) => { setDay(d); setView("day"); }} />}
      {view === "week" && <WeekStrip days={weekDays} selected={iso(day)} entries={entries} onSelect={(d) => setDay(d)} />}
      {view !== "month" && (
        <DayDetail date={day} entries={dayEntries} lookup={lookup} canEdit={canEdit} onStatus={setStatus}
          onAdd={() => setModal({ date: iso(day) })} onEdit={(e) => setModal(e)} onRemove={remove} />
      )}

      {modal && (
        <ScheduleModal entry={modal} jobs={jobs} res={res} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}
