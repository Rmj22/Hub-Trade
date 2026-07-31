import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { Briefcase, Clock, Truck, Wrench, AlertTriangle, FileText, Users, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

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

  useEffect(() => {
    api.get("/dashboard").then((r) => setD(r.data)).catch((e) => errMsg(e));
    api.get("/employees").then((r) => setEmployees(r.data)).catch(() => {});
  }, []);

  const greeting = user?.role === "owner" ? "Owner overview" : user?.role === "foreman" ? "Foreman overview" : "My day";

  return (
    <div data-testid="dashboard-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">{greeting}</div>
        <h1 className="font-head font-extrabold text-3xl sm:text-4xl tracking-tight">Hey {user?.name?.split(" ")[0]} 👋</h1>
      </div>

      {!d ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Stat testid="stat-active-jobs" icon={Briefcase} label="Active jobs" value={d.active_jobs} accent />
            <Stat testid="stat-clocked-in" icon={Clock} label="Clocked in" value={d.clocked_in} />
            {user?.role !== "employee" && <>
              <Stat testid="stat-equipment" icon={Wrench} label="Equipment assigned" value={d.equipment_assigned} />
              <Stat testid="stat-vehicles" icon={Truck} label="Vehicles in use" value={d.vehicles_in_use} />
              <Stat testid="stat-jobs-behind" icon={AlertTriangle} label="Jobs behind" value={d.jobs_behind} />
              <Stat testid="stat-estimates" icon={FileText} label="Upcoming estimates" value={d.upcoming_estimates} />
              <Stat testid="stat-employees" icon={Users} label="Team members" value={d.total_employees} />
              <Stat testid="stat-completed" icon={CheckCircle} label="Completed jobs" value={d.completed_jobs} />
            </>}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 border border-border rounded-md bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-head font-bold text-lg">Active jobs</h2>
                <Link to="/app/jobs" className="text-sm text-primary font-semibold" data-testid="view-all-jobs">View all</Link>
              </div>
              {d.active_jobs_list.length === 0 ? (
                <div className="text-muted-foreground text-sm py-8 text-center">No active jobs.</div>
              ) : (
                <div className="space-y-2">
                  {d.active_jobs_list.map((j) => (
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

            <div className="border border-border rounded-md bg-card p-6">
              <h2 className="font-head font-bold text-lg mb-4">Crew status</h2>
              {employees.length === 0 ? (
                <div className="text-muted-foreground text-sm py-8 text-center">No employees yet.</div>
              ) : (
                <div className="space-y-2">
                  {employees.slice(0, 6).map((e) => {
                    const on = (d.clocked_in_ids || []).includes(e.id);
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
          </div>
        </>
      )}
    </div>
  );
}
