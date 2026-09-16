import { Link } from "react-router-dom";
import { LifeBuoy } from "lucide-react";

const TICKET_STATUS_CLS = { done: "bg-green-500/15 text-green-500", in_progress: "bg-amber-500/15 text-amber-500" };
const ticketStatusCls = (s) => TICKET_STATUS_CLS[s] || "bg-primary/20 text-primary";
const pct = (remaining, total) => (total ? Math.min(100, (remaining / total) * 100) : 0);

export function HoursMeter({ d }) {
  return (
    <div className="border border-border rounded-md bg-card p-6" data-testid="dashboard-hours-meter">
      <div className="flex items-center gap-2 mb-4"><LifeBuoy className="w-5 h-5 text-primary" /><h2 className="font-head font-bold text-lg">Data-entry hours</h2></div>
      <div className="font-head font-extrabold text-4xl tracking-tight" data-testid="dashboard-hours-remaining">{d.data_hours_remaining}<span className="text-lg text-muted-foreground font-body font-normal"> / {d.data_hours_total} hrs left</span></div>
      <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct(d.data_hours_remaining, d.data_hours_total)}%` }} />
      </div>
      <div className="text-xs text-muted-foreground mt-2">{d.data_hours_used} of your {d.data_hours_total}-hr plan requested this term</div>
      <Link to="/app/data-entry" className="inline-block mt-4 text-sm text-primary font-semibold" data-testid="dashboard-request-help">Request more help →</Link>
    </div>
  );
}

export function TicketUpdates({ updates = [] }) {
  return (
    <div className="lg:col-span-2 border border-border rounded-md bg-card p-6" data-testid="dashboard-ticket-updates">
      <h2 className="font-head font-bold text-lg mb-4">Data-entry updates</h2>
      {updates.length === 0 && <div className="text-muted-foreground text-sm py-8 text-center">No updates yet. Submit a ticket and our team will get to work.</div>}
      {updates.length > 0 && (
        <div className="space-y-2">
          {updates.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3 rounded-md border border-border" data-testid="dashboard-ticket-update-row">
              <div>
                <div className="font-semibold text-sm">{t.title}</div>
                {t.admin_notes && <div className="text-xs text-muted-foreground">{t.admin_notes}</div>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${ticketStatusCls(t.status)}`}>{(t.status || "open").replace("_", " ")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ActiveJobsPanel({ jobs }) {
  return (
    <div className="lg:col-span-2 border border-border rounded-md bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-head font-bold text-lg">Active jobs</h2>
        <Link to="/app/jobs" className="text-sm text-primary font-semibold" data-testid="view-all-jobs">View all</Link>
      </div>
      {jobs.length === 0 && <div className="text-muted-foreground text-sm py-8 text-center">No active jobs.</div>}
      {jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.map((j) => (
            <div key={j.id} className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-muted/30 transition-colors">
              <div>
                <div className="font-semibold text-sm">{j.name}</div>
                <div className="text-xs text-muted-foreground">{j.customer_name || "—"} {j.due_date ? `· due ${j.due_date}` : ""}</div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 font-medium">active</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CrewStatus({ employees, clockedInIds = [] }) {
  return (
    <div className="border border-border rounded-md bg-card p-6">
      <h2 className="font-head font-bold text-lg mb-4">Crew status</h2>
      {employees.length === 0 && <div className="text-muted-foreground text-sm py-8 text-center">No employees yet.</div>}
      {employees.length > 0 && (
        <div className="space-y-2">
          {employees.slice(0, 6).map((e) => {
            const on = clockedInIds.includes(e.id);
            return (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span>{e.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${on ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{on ? "On site" : "Off"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
