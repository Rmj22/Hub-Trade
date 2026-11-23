import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { Briefcase, Clock, Truck, AlertTriangle, FileText, Users, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { HoursMeter, TicketUpdates, ActiveJobsPanel, CrewStatus } from "../components/dashboard/Panels";
import DashboardTour from "../components/DashboardTour";
import { Compass } from "lucide-react";

const GREETINGS = { owner: "Owner overview", foreman: "Foreman overview" };

const MANAGER_STATS = [
  { testid: "stat-vehicles", icon: Truck, label: "Vehicles in use", key: "vehicles_in_use", tone: "sky" },
  { testid: "stat-jobs-behind", icon: AlertTriangle, label: "Jobs behind", key: "jobs_behind", tone: "rose" },
  { testid: "stat-estimates", icon: FileText, label: "Upcoming estimates", key: "upcoming_estimates", tone: "violet" },
  { testid: "stat-employees", icon: Users, label: "Team members", key: "total_employees", tone: "teal" },
  { testid: "stat-completed", icon: CheckCircle, label: "Completed jobs", key: "completed_jobs", tone: "emerald" },
];

const TONES = {
  amber: ["bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", "bg-amber-400"],
  emerald: ["bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", "bg-emerald-500"],
  sky: ["bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", "bg-sky-500"],
  rose: ["bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", "bg-rose-500"],
  violet: ["bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300", "bg-indigo-500"],
  teal: ["bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300", "bg-teal-500"],
};

function Stat({ icon: Icon, label, value, tone = "amber", testid, i = 0 }) {
  const [chip, bar] = TONES[tone];
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
      className="relative overflow-hidden border border-border rounded-xl bg-card p-5 sm:p-6 hover:-translate-y-1 hover:shadow-lg transition-[transform,box-shadow]" data-testid={testid}>
      <span className={`absolute inset-x-0 top-0 h-1 ${bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${chip}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="font-head font-semibold text-4xl tracking-tight mt-3">{value}</div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [tour, setTour] = useState(0);
  const isManager = user?.role !== "employee";

  useEffect(() => {
    api.get("/dashboard").then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get("/employees").then((r) => setEmployees(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);

  const showDataEntry = isManager && d && (d.data_hours_total > 0 || d.recent_ticket_updates?.length > 0);

  return (
    <div data-testid="dashboard-page">
      {d && user?.role === "owner" && <DashboardTour key={tour} user={user} forceOpen={tour > 0} onClose={() => setTour(0)} />}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">{GREETINGS[user?.role] || "My day"}</div>
          <h1 className="font-head font-semibold text-3xl sm:text-4xl tracking-tight">Hey {user?.name?.split(" ")[0]} 👋</h1>
        </div>
        {user?.role === "owner" && (
          <button onClick={() => setTour((n) => n + 1)} data-testid="dashboard-tour-btn"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors shrink-0">
            <Compass className="w-4 h-4" /> Take the tour
          </button>
        )}
      </div>

      {!d && <div className="text-muted-foreground">Loading…</div>}
      {d && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Stat testid="stat-active-jobs" icon={Briefcase} label="Active jobs" value={d.active_jobs} tone="amber" />
            <Stat testid="stat-clocked-in" icon={Clock} label="Clocked in" value={d.clocked_in} tone="emerald" i={1} />
            {isManager && MANAGER_STATS.map((s, idx) => <Stat key={s.key} testid={s.testid} icon={s.icon} label={s.label} value={d[s.key]} tone={s.tone} i={idx + 2} />)}
          </div>

          {showDataEntry && (
            <div className="grid lg:grid-cols-3 gap-6 mb-8">
              <HoursMeter d={d} />
              <TicketUpdates updates={d.recent_ticket_updates} />
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            <ActiveJobsPanel jobs={d.active_jobs_list} />
            <CrewStatus employees={employees} clockedInIds={d.clocked_in_ids} />
          </div>
        </>
      )}
    </div>
  );
}
