import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { Briefcase, Clock, Truck, Wrench, AlertTriangle, FileText, Users, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { HoursMeter, TicketUpdates, ActiveJobsPanel, CrewStatus } from "../components/dashboard/Panels";

const GREETINGS = { owner: "Owner overview", foreman: "Foreman overview" };

const MANAGER_STATS = [
  { testid: "stat-equipment", icon: Wrench, label: "Equipment assigned", key: "equipment_assigned" },
  { testid: "stat-vehicles", icon: Truck, label: "Vehicles in use", key: "vehicles_in_use" },
  { testid: "stat-jobs-behind", icon: AlertTriangle, label: "Jobs behind", key: "jobs_behind" },
  { testid: "stat-estimates", icon: FileText, label: "Upcoming estimates", key: "upcoming_estimates" },
  { testid: "stat-employees", icon: Users, label: "Team members", key: "total_employees" },
  { testid: "stat-completed", icon: CheckCircle, label: "Completed jobs", key: "completed_jobs" },
];

function Stat({ icon: Icon, label, value, accent, testid }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="border border-border rounded-md bg-card p-6 hover:-translate-y-1 transition-transform" data-testid={testid}>
      <div className={`w-10 h-10 rounded-md flex items-center justify-center mb-4 ${accent ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="font-head font-extrabold text-3xl tracking-tight">{value}</div>
      <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground mt-1">{label}</div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [employees, setEmployees] = useState([]);
  const isManager = user?.role !== "employee";

  useEffect(() => {
    api.get("/dashboard").then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get("/employees").then((r) => setEmployees(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);

  const showDataEntry = isManager && d && (d.data_hours_total > 0 || d.recent_ticket_updates?.length > 0);

  return (
    <div data-testid="dashboard-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">{GREETINGS[user?.role] || "My day"}</div>
        <h1 className="font-head font-extrabold text-3xl sm:text-4xl tracking-tight">Hey {user?.name?.split(" ")[0]} 👋</h1>
      </div>

      {!d && <div className="text-muted-foreground">Loading…</div>}
      {d && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Stat testid="stat-active-jobs" icon={Briefcase} label="Active jobs" value={d.active_jobs} accent />
            <Stat testid="stat-clocked-in" icon={Clock} label="Clocked in" value={d.clocked_in} />
            {isManager && MANAGER_STATS.map((s) => <Stat key={s.key} testid={s.testid} icon={s.icon} label={s.label} value={d[s.key]} />)}
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
