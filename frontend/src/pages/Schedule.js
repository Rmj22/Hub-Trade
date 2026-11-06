import { useEffect, useState, useCallback, useMemo } from "react";
import { api, errMsg } from "../lib/api";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useResources } from "../components/jobs/CrewModal";
import { WeekStrip, DayDetail, ScheduleModal } from "../components/schedule/ScheduleParts";

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

export default function SchedulePage() {
  const { user } = useAuth();
  const res = useResources();
  const [jobs, setJobs] = useState([]);
  const [day, setDay] = useState(() => new Date(new Date().setHours(12, 0, 0, 0)));
  const [entries, setEntries] = useState([]);
  const [modal, setModal] = useState(null);
  const canEdit = user?.role !== "employee";

  const weekStart = useMemo(() => startOfWeek(day), [day]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/schedule", { params: { start: iso(weekStart), end: iso(addDays(weekStart, 6)) } });
      setEntries(data);
    } catch (e) { toast.error(errMsg(e)); }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get("/jobs").then((r) => setJobs(r.data)).catch((e) => toast.error(errMsg(e))); }, []);

  const lookup = useMemo(() => {
    const m = {};
    [...res.employees, ...res.vehicles, ...res.equipment, ...jobs].forEach((x) => { m[x.id] = x; });
    return m;
  }, [res, jobs]);

  const dayEntries = entries.filter((e) => e.date === iso(day));

  const remove = async (id) => {
    try { await api.delete(`/schedule/${id}`); toast.success("Removed from schedule"); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div data-testid="schedule-page">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Plan the day</div>
          <h1 className="font-head font-extrabold text-3xl sm:text-4xl tracking-tight">Schedule</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDay(addDays(day, -7))} data-testid="schedule-prev-week" className="p-2 rounded-md border border-border hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setDay(new Date(new Date().setHours(12, 0, 0, 0)))} data-testid="schedule-today" className="px-3 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted inline-flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Today</button>
          <button onClick={() => setDay(addDays(day, 7))} data-testid="schedule-next-week" className="p-2 rounded-md border border-border hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <WeekStrip days={weekDays} selected={iso(day)} entries={entries} onSelect={(d) => setDay(d)} />

      <DayDetail date={day} entries={dayEntries} lookup={lookup} canEdit={canEdit}
        onAdd={() => setModal({ date: iso(day) })} onEdit={(e) => setModal(e)} onRemove={remove} />

      {modal && (
        <ScheduleModal entry={modal} jobs={jobs} res={res} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}
