import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { toast } from "sonner";
import { Bell, LogIn, LogOut, CalendarClock, UserPlus, AlarmClockOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const PREFS = [
  { key: "clock_in", icon: LogIn, label: "Employee Clock-In", desc: "When a crew member clocks in: name, job site, time and date." },
  { key: "clock_out", icon: LogOut, label: "Employee Clock-Out", desc: "When a crew member clocks out, with hours worked." },
  { key: "schedule_change", icon: CalendarClock, label: "Job Schedule Changes", desc: "Dates added or moved, and job status changes." },
  { key: "assignment", icon: UserPlus, label: "New Job Assignments", desc: "When someone is assigned to a job." },
  { key: "missed_clock_in", icon: AlarmClockOff, label: "Missed Clock-Ins", desc: "A scheduled crew member hasn't clocked in for the day." },
];

function Toggle({ on, onChange, testid }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)} data-testid={testid}
      className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${on ? "bg-primary" : "bg-muted"}`}>
      <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(null);
  const canEdit = user?.role !== "employee";

  useEffect(() => { api.get("/notification-prefs").then((r) => setPrefs(r.data)).catch((e) => toast.error(errMsg(e))); }, []);

  const update = async (key, value) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try { await api.put("/notification-prefs", next); toast.success(`${PREFS.find((p) => p.key === key).label} ${value ? "on" : "off"}`); }
    catch (e) { toast.error(errMsg(e)); setPrefs(prefs); }
  };

  return (
    <div data-testid="notification-settings-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Settings</div>
        <h1 className="font-head font-extrabold text-3xl sm:text-4xl tracking-tight">Notification preferences</h1>
        <p className="text-muted-foreground text-sm mt-1">Choose what shows up in your bell. Saved to your account and applied immediately.</p>
      </div>
      {!prefs ? <div className="text-muted-foreground text-sm">Loading…</div> : (
        <div className="border border-border rounded-md bg-card divide-y divide-border max-w-2xl">
          {PREFS.map((p) => (
            <div key={p.key} className="flex items-center gap-4 p-4 sm:p-5" data-testid={`pref-row-${p.key}`}>
              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0"><p.icon className="w-5 h-5 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{p.label}</div>
                <div className="text-xs text-muted-foreground">{p.desc}</div>
              </div>
              {canEdit ? <Toggle on={prefs[p.key]} onChange={(v) => update(p.key, v)} testid={`pref-toggle-${p.key}`} />
                : <span className="text-xs text-muted-foreground">Owner only</span>}
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 text-xs text-muted-foreground inline-flex items-center gap-2"><Bell className="w-3.5 h-3.5" /> Clock-in, clock-out and missed clock-in alerts are only ever shown to owners and foremen.</div>
    </div>
  );
}
