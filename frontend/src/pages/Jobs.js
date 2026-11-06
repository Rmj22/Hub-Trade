import { useState, useEffect } from "react";
import { Users, Camera } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useOffline } from "../lib/offline";
import CrudManager from "../components/CrudManager";
import { CrewModal } from "../components/jobs/CrewModal";
import { JobPhotosModal } from "../components/jobs/JobPhotosModal";
import { JOB_COLUMNS, JOB_FIELDS } from "./Resources";

const COLUMNS = [
  ...JOB_COLUMNS,
  { key: "crew", label: "Crew", render: (it) => (
    <span className="inline-flex items-center gap-1 text-xs" data-testid="job-crew-count">
      <Users className="w-3.5 h-3.5 text-primary" /> {it.assigned_employees?.length || 0} · {it.assigned_vehicles?.length || 0} veh · {it.assigned_equipment?.length || 0} eq
    </span>
  ) },
  { key: "photos", label: "Photos", render: (it) => <span className="text-xs text-muted-foreground" data-testid="job-photo-count">{it.photos?.length || 0}</span> },
];

export default function JobsPage() {
  const { user } = useAuth();
  const { online, pending } = useOffline();
  const [crewJob, setCrewJob] = useState(null);
  const [photoJob, setPhotoJob] = useState(null);
  const canAssign = user?.role !== "employee";
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => { if (online && pending === 0) setReloadKey((k) => k + 1); }, [online, pending]);

  const renderExtra = (it, reload) => (
    <>
      <button onClick={() => setPhotoJob({ ...it, _reload: reload })} data-testid="jobs-photos-btn" title="Job photos"
        className="p-1.5 rounded hover:bg-muted transition-colors"><Camera className="w-4 h-4" /></button>
      {canAssign && online && (
        <button onClick={() => setCrewJob({ ...it, _reload: reload })} data-testid="jobs-crew-btn" title="Assign crew"
          className="p-1.5 rounded hover:bg-muted transition-colors text-primary"><Users className="w-4 h-4" /></button>
      )}
    </>
  );

  return (
    <>
      <CrudManager key={reloadKey} title="Jobs" endpoint="jobs" testid="jobs" columns={COLUMNS} fields={JOB_FIELDS} canWrite={canAssign} renderExtra={renderExtra} />
      {crewJob && <CrewModal job={crewJob} onClose={() => setCrewJob(null)} onSaved={() => crewJob._reload()} />}
      {photoJob && <JobPhotosModal job={photoJob} onClose={() => { setPhotoJob(null); photoJob._reload(); }} />}
    </>
  );
}
