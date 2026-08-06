import CrudManager from "../components/CrudManager";

const badge = (v, map) => {
  const cls = map[v] || "bg-muted text-muted-foreground";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{v}</span>;
};

export function JobsPage() {
  return (
    <CrudManager
      title="Jobs" endpoint="jobs" testid="jobs"
      columns={[
        { key: "name", label: "Job" },
        { key: "customer_name", label: "Customer" },
        { key: "status", label: "Status", render: (it) => badge(it.status, { active: "bg-green-500/15 text-green-500", behind: "bg-destructive/15 text-destructive", completed: "bg-blue-500/15 text-blue-500" }) },
        { key: "due_date", label: "Due" },
        { key: "material_cost", label: "Materials", render: (it) => `$${(it.material_cost || 0).toLocaleString()}` },
      ]}
      fields={[
        { key: "name", label: "Job Name", type: "text" },
        { key: "customer_name", label: "Customer Name", type: "text" },
        { key: "address", label: "Address", type: "text" },
        { key: "status", label: "Status", type: "select", options: ["active", "behind", "completed"], default: "active" },
        { key: "due_date", label: "Due Date", type: "date" },
        { key: "material_cost", label: "Material Cost ($)", type: "number" },
        { key: "onsite_purchases", label: "On-site Purchases ($)", type: "number" },
        { key: "description", label: "Description", type: "textarea" },
      ]}
    />
  );
}

export function VehiclesPage() {
  return (
    <CrudManager
      title="Vehicles" endpoint="vehicles" testid="vehicles"
      columns={[
        { key: "name", label: "Vehicle" },
        { key: "plate", label: "Plate" },
        { key: "status", label: "Status", render: (it) => badge(it.status, { available: "bg-green-500/15 text-green-500", "in-use": "bg-primary/20 text-primary" }) },
        { key: "insurance_expiry", label: "Insurance Exp" },
        { key: "registration_expiry", label: "Reg Exp" },
        { key: "hours_used", label: "Hours" },
      ]}
      fields={[
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
      ]}
    />
  );
}

export function EquipmentPage() {
  return (
    <CrudManager
      title="Equipment" endpoint="equipment" testid="equipment"
      columns={[
        { key: "name", label: "Tool" },
        { key: "category", label: "Category" },
        { key: "condition", label: "Condition" },
        { key: "location", label: "Location" },
        { key: "status", label: "Status", render: (it) => badge(it.status, { available: "bg-green-500/15 text-green-500", assigned: "bg-primary/20 text-primary" }) },
        { key: "inspection_date", label: "Inspection" },
        { key: "hours_used", label: "Hours" },
      ]}
      fields={[
        { key: "name", label: "Tool", type: "text" },
        { key: "category", label: "Category", type: "text" },
        { key: "condition", label: "Condition", type: "text" },
        { key: "location", label: "Location", type: "text" },
        { key: "status", label: "Status", type: "select", options: ["available", "assigned"], default: "available" },
        { key: "inspection_date", label: "Last Inspection", type: "date" },
        { key: "service_reminder", label: "Service Reminder", type: "date" },
        { key: "hours_used", label: "Hours of Use", type: "number" },
      ]}
    />
  );
}
