import { useEffect, useState, useCallback } from "react";
import { api, API, errMsg } from "../lib/api";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { AuditFilterBar, AuditTable } from "../components/audit/AuditParts";

const rangeInvalid = (s, e) => s && e && s > e;

const downloadBlob = (blob, name) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  window.URL.revokeObjectURL(url);
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (s = "", e = "") => {
    setLoading(true);
    try {
      const params = {};
      if (s) params.start = s;
      if (e) params.end = e;
      const { data } = await api.get("/audit-logs", { params });
      setLogs(data);
    } catch (err) { toast.error(errMsg(err)); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const applyFilter = () => {
    if (rangeInvalid(start, end)) { toast.error("Start date must be before end date"); return; }
    load(start, end);
  };

  const clearFilter = () => { setStart(""); setEnd(""); load("", ""); };

  const exportCsv = async () => {
    if (rangeInvalid(start, end)) { toast.error("Start date must be before end date"); return; }
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (start) params.append("start", start);
      if (end) params.append("end", end);
      const resp = await fetch(`${API}/audit-logs/export?${params.toString()}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Export failed");
      downloadBlob(await resp.blob(), `audit_logs_${start || "all"}_to_${end || "all"}.csv`);
      toast.success("CSV exported");
    } catch (e) { toast.error(e.message || "Export failed"); }
    setExporting(false);
  };

  return (
    <div data-testid="audit-logs-page">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Activity</div>
          <h1 className="font-head font-extrabold text-3xl sm:text-4xl tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground text-sm mt-1">Every important action across your company, with a full trail.</p>
        </div>
        <button data-testid="audit-export-btn" onClick={exportCsv} disabled={exporting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60">
          <Download className="w-4 h-4" /> {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      <AuditFilterBar start={start} end={end} setStart={setStart} setEnd={setEnd} onApply={applyFilter} onClear={clearFilter} />

      {loading ? <div className="text-muted-foreground">Loading…</div> : <AuditTable logs={logs} />}
    </div>
  );
}
