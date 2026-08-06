import { useEffect, useState, useCallback } from "react";
import { api, API, errMsg } from "../lib/api";
import { toast } from "sonner";
import { Download, Filter, ScrollText } from "lucide-react";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (s = start, e = end) => {
    setLoading(true);
    try {
      const params = {};
      if (s) params.start = s;
      if (e) params.end = e;
      const { data } = await api.get("/audit-logs", { params });
      setLogs(data);
    } catch (err) { toast.error(errMsg(err)); }
    setLoading(false);
  }, [start, end]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const applyFilter = () => {
    if (start && end && start > end) { toast.error("Start date must be before end date"); return; }
    load(start, end);
  };

  const exportCsv = async () => {
    if (start && end && start > end) { toast.error("Start date must be before end date"); return; }
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (start) params.append("start", start);
      if (end) params.append("end", end);
      const resp = await fetch(`${API}/audit-logs/export?${params.toString()}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_logs_${start || "all"}_to_${end || "all"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch (e) { toast.error(e.message || "Export failed"); }
    setExporting(false);
  };

  const fmt = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };
  const inp = "px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none";

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

      <div className="border border-border rounded-md bg-card p-4 mb-6 flex items-end gap-4 flex-wrap" data-testid="audit-filter-bar">
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">From</label>
          <input data-testid="audit-start-date" type="date" className={inp} value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">To</label>
          <input data-testid="audit-end-date" type="date" className={inp} value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <button data-testid="audit-apply-filter-btn" onClick={applyFilter}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border font-medium text-sm hover:bg-muted transition-colors">
          <Filter className="w-4 h-4" /> Apply
        </button>
        {(start || end) && (
          <button data-testid="audit-clear-filter-btn" onClick={() => { setStart(""); setEnd(""); load("", ""); }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors">Clear</button>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="border border-dashed border-border rounded-md p-12 text-center text-muted-foreground" data-testid="audit-empty">
          <ScrollText className="w-8 h-8 mx-auto mb-3 text-primary" />
          No activity found for this range.
        </div>
      ) : (
        <div className="border border-border rounded-md bg-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Timestamp</th>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">User</th>
                <th className="text-left px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid="audit-log-row">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmt(l.created_at)}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{l.user_name}</td>
                  <td className="px-4 py-3">{l.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
