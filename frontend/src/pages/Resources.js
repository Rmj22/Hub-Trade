import CrudManager from "../components/CrudManager";

const badge = (v, map) => {
  const cls = map[v] || "bg-muted text-muted-foreground";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{v}</span>;
};

const GREEN = "bg-green-500/15 text-green-500";
const PRIMARY = "bg-primary/20 text-primary";

const JOB_COLUMNS = [
  { key: "name", label: "Job" },
  { key: "customer_name", label: "Customer" },
  { key: "status", label: "Status", render: (it) => badge(it.status, { active: GREEN, behind: "bg-destructive/15 text-destructive", completed: "bg-blue-500/15 text-blue-500" }) },
  { key: "due_date", label: "Due" },
  { key: "material_cost", label: "Materials", render: (it) => `$${(it.material_cost || 0).toLocaleString()}` },
];
const JOB_FIELDS = [
  { key: "name", label: "Job Name", type: "text" },
  { key: "customer_name", label: "Customer Name", type: "text" },
  { key: "address", label: "Address", type: "text" },
  { key: "status", label: "Status", type: "select", options: ["active", "behind", "completed"], default: "active" },
  { key: "due_date", label: "Due Date", type: "date" },
  { key: "material_cost", label: "Material Cost ($)", type: "number" },
  { key: "onsite_purchases", label: "On-site Purchases ($)", type: "number" },
  { key: "description", label: "Description", type: "textarea" },
];

const VEHICLE_COLUMNS = [
  { key: "name", label: "Vehicle" },
  { key: "plate", label: "Plate" },
  { key: "status", label: "Status", render: (it) => badge(it.status, { available: GREEN, "in-use": PRIMARY }) },
  { key: "insurance_expiry", label: "Insurance Exp" },
  { key: "registration_expiry", label: "Reg Exp" },
  { key: "hours_used", label: "Hours" },
];
const VEHICLE_FIELDS = [
  { key: "name", label: "Name / Model", type: "text" },
  { key: "plate", label: "License Plate", type: "text" },
  { key: "type", label: "Type", type: "select", options: ["Truck", "Van", "Pickup", "Trailer", "Other"], default: "Truck" },
  { key: "status", label: "Status", type: "select", options: ["available", "in-use"], default: "available" },
  { key: "oil_change_date", label: "Last Oil Change", type: "date" },
  { key: "tire_rotation_date", label: "Last Tire Rotation", type: "date" },
  { key: "registration_expiry", label: "Registration Expiry", type: "date" },
  { key: "insurance_expiry", label: "Insurance Expiry", type: "date" },
  { key: "inspection_date", label: "Inspection Reminder", type: "date" },
  { key: "hours_used", label: "Hours Used", type: "number" },
];

const EQUIPMENT_COLUMNS = [
  { key: "name", label: "Tool" },
  { key: "category", label: "Category" },
  { key: "condition", label: "Condition" },
  { key: "location", label: "Location" },
  { key: "status", label: "Status", render: (it) => badge(it.status, { available: GREEN, assigned: PRIMARY }) },
  { key: "inspection_date", label: "Inspection" },
  { key: "hours_used", label: "Hours" },
];
const EQUIPMENT_FIELDS = [
  { key: "name", label: "Tool", type: "text" },
  { key: "category", label: "Category", type: "text" },
  { key: "condition", label: "Condition", type: "text" },
  { key: "location", label: "Location", type: "text" },
  { key: "status", label: "Status", type: "select", options: ["available", "assigned"], default: "available" },
  { key: "inspection_date", label: "Last Inspection", type: "date" },
  { key: "service_reminder", label: "Service Reminder", type: "date" },
  { key: "hours_used", label: "Hours of Use", type: "number" },
];

export function JobsPage() {
  return <CrudManager title="Jobs" endpoint="jobs" testid="jobs" columns={JOB_COLUMNS} fields={JOB_FIELDS} />;
}

export function VehiclesPage() {
  return <CrudManager title="Vehicles" endpoint="vehicles" testid="vehicles" columns={VEHICLE_COLUMNS} fields={VEHICLE_FIELDS} />;
}

export function EquipmentPage() {
  return <CrudManager title="Equipment" endpoint="equipment" testid="equipment" columns={EQUIPMENT_COLUMNS} fields={EQUIPMENT_FIELDS} />;
}
