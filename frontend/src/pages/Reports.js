import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { Clock, DollarSign, Truck, Wrench, CheckCircle, Package } from "lucide-react";

const Card = ({ icon: Icon, label, value, testid }) => (
  <div className="border border-border rounded-md bg-card p-6" data-testid={testid}>
    <Icon className="w-6 h-6 text-primary mb-4" />
    <div className="font-head font-extrabold text-3xl tracking-tight">{value}</div>
    <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground mt-1">{label}</div>
  </div>
);

export default function ReportsPage() {
  const [r, setR] = useState(null);
  useEffect(() => { api.get("/reports/weekly").then((res) => setR(res.data)).catch((e) => errMsg(e)); }, []);

  return (
    <div data-testid="reports-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Last 7 days</div>
        <h1 className="font-head font-extrabold text-3xl sm:text-4xl tracking-tight">Weekly report</h1>
      </div>
      {!r ? <div className="text-muted-foreground">Loading…</div> : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Card testid="report-labor-hours" icon={Clock} label="Labor hours" value={`${r.labor_hours}h`} />
          <Card testid="report-labor-cost" icon={DollarSign} label="Labor cost" value={`$${r.labor_cost.toLocaleString()}`} />
          <Card testid="report-equipment-hours" icon={Wrench} label="Equipment hours" value={`${r.equipment_hours}h`} />
          <Card testid="report-vehicle-hours" icon={Truck} label="Vehicle usage" value={`${r.vehicle_hours}h`} />
          <Card testid="report-material-cost" icon={Package} label="Material + on-site" value={`$${r.material_cost.toLocaleString()}`} />
          <Card testid="report-completed-jobs" icon={CheckCircle} label="Completed jobs" value={r.completed_jobs} />
        </div>
      )}
    </div>
  );
}
