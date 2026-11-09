import { useEffect, useState, useCallback } from "react";
import { api, errMsg } from "../lib/api";
import { cachedGet, enqueue, isOnline, isNetworkError, useOffline } from "../lib/offline";
import { toast } from "sonner";
import { LogIn, LogOut, Clock, CloudOff } from "lucide-react";

const RECENT_CARDS_LIMIT = 30;
const LOCAL_ACTIVE_KEY = "ht:local-active";
const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL_ACTIVE_KEY)) || {}; } catch { return {}; } };

export default function TimeCardsPage() {
  const { online, pending } = useOffline();
  const [employees, setEmployees] = useState([]);
  const [active, setActive] = useState([]);
  const [cards, setCards] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [sel, setSel] = useState({});
  const [fromCache, setFromCache] = useState(false);
  const [localActive, setLocalActive] = useState(readLocal());

  const load = useCallback(async () => {
    try {
      const [e, a, t, j] = await Promise.all(["/employees", "/timecards/active", "/timecards", "/jobs"].map(cachedGet));
      setEmployees(e.data); setActive(a.data); setCards(t.data); setJobs(j.data);
      setFromCache(e.fromCache || a.fromCache);
      if (!a.fromCache) { setLocalActive({}); localStorage.removeItem(LOCAL_ACTIVE_KEY); }
    } catch (err) { toast.error(errMsg(err)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (online && pending === 0) load(); }, [online, pending, load]);

  const serverActive = active.map((a) => a.employee_id);
  const isOn = (id) => (id in localActive ? localActive[id] : serverActive.includes(id));
  const empName = (id) => employees.find((e) => e.id === id)?.name || "Unknown";
  const jobName = (id) => jobs.find((j) => j.id === id)?.name || "—";

  const setLocal = (id, on) => { const next = { ...localActive, [id]: on }; setLocalActive(next); localStorage.setItem(LOCAL_ACTIVE_KEY, JSON.stringify(next)); };

  const act = async (type, id) => {
    const body = type === "clock-in" ? { employee_id: id, job_id: sel[id] || null } : { employee_id: id };
    const on = type === "clock-in";
    const queueIt = () => { enqueue({ type, body }); setLocal(id, on); toast.info(`${on ? "Clock-in" : "Clock-out"} saved offline — will sync when back online`); };
    if (!isOnline()) { queueIt(); return; }
    try { await api.post(`/timecards/${type}`, body); toast.success(on ? "Clocked in" : "Clocked out"); load(); }
    catch (e) { if (isNetworkError(e)) queueIt(); else toast.error(errMsg(e)); }
  };

  const inp = "px-2 py-1.5 rounded-md border border-input bg-background text-xs focus:ring-2 focus:ring-primary focus:outline-none";

  return (
    <div data-testid="timecards-page">
      <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Attendance</div>
          <h1 className="font-head font-extrabold text-3xl sm:text-4xl tracking-tight">Time cards</h1>
        </div>
        {fromCache && <span className="inline-flex items-center gap-1.5 text-xs text-amber-500" data-testid="timecards-cached"><CloudOff className="w-3.5 h-3.5" /> Showing saved copy</span>}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {employees.length === 0 && <div className="text-muted-foreground col-span-full">Add employees first (Team page).</div>}
        {employees.map((e) => {
          const on = isOn(e.id);
          const queuedLocal = e.id in localActive;
          return (
            <div key={e.id} className="border border-border rounded-md bg-card p-5" data-testid="timecard-employee">
              <div className="flex items-center justify-between mb-3">
                <div><div className="font-semibold">{e.name}</div><div className="text-xs text-muted-foreground">{e.role_title}</div></div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${on ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`} data-testid="timecard-status">{on ? "On site" : "Off"}{queuedLocal ? " · pending" : ""}</span>
              </div>
              {!on && (
                <select className={inp + " w-full mb-3"} value={sel[e.id] || ""} onChange={(ev) => setSel({ ...sel, [e.id]: ev.target.value })} data-testid="timecard-job-select">
                  <option value="">No job</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              )}
              {on ? (
                <button data-testid="clock-out-btn" onClick={() => act("clock-out", e.id)} className="w-full py-2 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors inline-flex items-center justify-center gap-2"><LogOut className="w-4 h-4" /> Clock out</button>
              ) : (
                <button data-testid="clock-in-btn" onClick={() => act("clock-in", e.id)} className="w-full py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2"><LogIn className="w-4 h-4" /> Clock in</button>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="font-head font-bold text-xl mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> Recent entries</h2>
      <div className="border border-border rounded-md bg-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/50"><th className="text-left px-4 py-3 font-semibold">Employee</th><th className="text-left px-4 py-3 font-semibold">Job</th><th className="text-left px-4 py-3 font-semibold">In</th><th className="text-left px-4 py-3 font-semibold">Out</th><th className="text-left px-4 py-3 font-semibold">Hours</th></tr></thead>
          <tbody>
            {cards.slice(0, RECENT_CARDS_LIMIT).map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0" data-testid="timecard-row">
                <td className="px-4 py-3">{empName(c.employee_id)}{c.offline_synced && <span className="ml-1 text-[10px] text-muted-foreground">(synced)</span>}</td>
                <td className="px-4 py-3 text-muted-foreground">{jobName(c.job_id)}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(c.clock_in).toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.clock_out ? new Date(c.clock_out).toLocaleString() : "—"}</td>
                <td className="px-4 py-3 font-semibold">{c.hours != null ? `${c.hours}h` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
