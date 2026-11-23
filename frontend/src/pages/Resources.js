import CrudManager from "../components/CrudManager";

const badge = (label, cls) => <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}><span className="w-2 h-2 rounded-full bg-current" />{label}</span>;

export const GREEN = "bg-green-500/15 text-green-500";
export const RED = "bg-red-500/15 text-red-500";
export const BLACK = "bg-foreground text-background";
const PRIMARY = "bg-primary/20 text-primary";

export const JOB_STATUS = {
  scheduled: { label: "Scheduled", cls: "bg-sky-500/15 text-sky-500" },
  in_progress: { label: "In Progress", cls: "bg-amber-500/15 text-amber-500" },
  completed: { label: "Completed", cls: BLACK },
  delayed: { label: "Delayed", cls: RED },
  rescheduled: { label: "Rescheduled", cls: "bg-violet-500/15 text-violet-500" },
};
export const JOB_STATUS_OPTIONS = Object.entries(JOB_STATUS).map(([value, v]) => ({ value, label: v.label }));
export const jobStatusBadge = (s) => { const m = JOB_STATUS[s] || JOB_STATUS.scheduled; return badge(m.label, m.cls); };

export const JOB_COLUMNS = [
  { key: "name", label: "Job", render: (it) => <span data-testid="job-name">{it.name}</span> },
  { key: "status", label: "Status", render: (it) => jobStatusBadge(it.status) },
  { key: "start_date", label: "Start" },
  { key: "work_dates", label: "Extra dates", render: (it) => (it.work_dates?.length ? `${it.work_dates.length} more day${it.work_dates.length > 1 ? "s" : ""}` : "—") },
  { key: "completion_date", label: "Completion" },
  { key: "address", label: "Address" },
];
export const JOB_FIELDS = [
  { key: "customer_name", label: "Customer Name", type: "text" },
  { key: "address", label: "Address", type: "text" },
  { key: "start_date", label: "Start Date", type: "date" },
  { key: "completion_date", label: "Completion Date", type: "date" },
  { key: "status", label: "Status", type: "select", options: JOB_STATUS_OPTIONS, default: "scheduled" },
  { key: "description", label: "Description", type: "textarea" },
];

const VEHICLE_COLUMNS = [
  { key: "name", label: "Vehicle" },
  { key: "type", label: "Type" },
  { key: "plate", label: "Plate" },
  { key: "status", label: "Status", render: (it) => badge(it.status === "in-use" ? "In use" : "Available", it.status === "in-use" ? PRIMARY : GREEN) },
  { key: "ownership", label: "Rental", render: (it) => it.type !== "Large Vehicle" ? "—" : it.ownership === "rent" ? badge(it.rental_status === "returned" ? "Returned" : "Still in use", it.rental_status === "returned" ? RED : GREEN) : "Owned" },
  { key: "rental_start_date", label: "Rental start", render: (it) => it.ownership === "rent" && it.type === "Large Vehicle" ? it.rental_start_date || "—" : "—" },
  { key: "insurance_expiry", label: "Insurance Exp" },
  { key: "registration_expiry", label: "Reg Exp" },
];
const isLarge = (f) => f.type === "Large Vehicle";
const isRent = (f) => isLarge(f) && f.ownership === "rent";
const VEHICLE_FIELDS = [
  { key: "type", label: "Vehicle Type", type: "select", options: ["Truck", "Trailer", "Large Vehicle"], default: "Truck" },
  { key: "ownership", label: "Ownership", type: "select", options: [{ value: "own", label: "Own" }, { value: "rent", label: "Rent" }], default: "own", showIf: isLarge },
  { key: "rental_start_date", label: "Rental Start Date", type: "date", showIf: isRent },
  { key: "rental_status", label: "Rental Status", type: "select", options: [{ value: "in_use", label: "Green — Still in use" }, { value: "returned", label: "Red — Returned" }], default: "in_use", showIf: isRent },
  { key: "name", label: "Name / Model", type: "text" },
  { key: "plate", label: "License Plate", type: "text" },
  { key: "status", label: "Status", type: "select", options: [{ value: "available", label: "Available" }, { value: "in-use", label: "In use" }], default: "available" },
  { key: "oil_change_date", label: "Last Oil Change", type: "date" },
  { key: "tire_rotation_date", label: "Last Tire Rotation", type: "date" },
  { key: "registration_expiry", label: "Registration Expiry", type: "date" },
  { key: "insurance_expiry", label: "Insurance Expiry", type: "date" },
];

const EQUIPMENT_COLUMNS = [
  { key: "name", label: "Tool" },
  { key: "category", label: "Category" },
  { key: "condition", label: "Condition" },
  { key: "status", label: "Status", render: (it) => badge(it.status === "servicing" ? "Being serviced" : "Available", it.status === "servicing" ? RED : GREEN) },
];
const EQUIPMENT_FIELDS = [
  { key: "name", label: "Tool", type: "text" },
  { key: "category", label: "Category", type: "select", options: ["Power Hand Tool", "Shop Tool", "Vehicle Tool"], default: "Power Hand Tool" },
  { key: "condition", label: "Condition", type: "text" },
  { key: "status", label: "Status", type: "select", options: [{ value: "available", label: "Green — Available" }, { value: "servicing", label: "Red — Being serviced" }], default: "available" },
];

export function VehiclesPage() {
  return <CrudManager title="Vehicles" endpoint="vehicles" testid="vehicles" columns={VEHICLE_COLUMNS} fields={VEHICLE_FIELDS} />;
}

export function EquipmentPage() {
  return <CrudManager title="Equipment" endpoint="equipment" testid="equipment" columns={EQUIPMENT_COLUMNS} fields={EQUIPMENT_FIELDS} />;
}
