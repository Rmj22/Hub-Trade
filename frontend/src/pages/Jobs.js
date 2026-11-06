import { useState } from "react";
import { Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import CrudManager from "../components/CrudManager";
import { CrewModal } from "../components/jobs/CrewModal";
import { JOB_COLUMNS, JOB_FIELDS } from "./Resources";

const crewCount = (it) => (it.assigned_employees?.length || 0) + (it.assigned_vehicles?.length || 0) + (it.assigned_equipment?.length || 0);

const COLUMNS = [
  ...JOB_COLUMNS,
  { key: "crew", label: "Crew", render: (it) => (
    <span className="inline-flex items-center gap-1 text-xs" data-testid="job-crew-count">
      <Users className="w-3.5 h-3.5 text-primary" /> {it.assigned_employees?.length || 0} · {it.assigned_vehicles?.length || 0} veh · {it.assigned_equipment?.length || 0} eq
    </span>
  ) },
];

export default function JobsPage() {
  const { user } = useAuth();
  const [crewJob, setCrewJob] = useState(null);
  const canAssign = user?.role !== "employee";

  const renderExtra = (it, reload) => canAssign && (
    <button onClick={() => setCrewJob({ ...it, _reload: reload })} data-testid="jobs-crew-btn" title={`Assign crew (${crewCount(it)})`}
      className="p-1.5 rounded hover:bg-muted transition-colors text-primary"><Users className="w-4 h-4" /></button>
  );

  return (
    <>
      <CrudManager title="Jobs" endpoint="jobs" testid="jobs" columns={COLUMNS} fields={JOB_FIELDS} canWrite={canAssign} renderExtra={renderExtra} />
      {crewJob && <CrewModal job={crewJob} onClose={() => setCrewJob(null)} onSaved={() => crewJob._reload()} />}
    </>
  );
}
