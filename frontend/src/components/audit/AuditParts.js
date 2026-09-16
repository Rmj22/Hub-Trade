import { Filter, ScrollText } from "lucide-react";

const inp = "px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none";
const fmt = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };

export function AuditFilterBar({ start, end, setStart, setEnd, onApply, onClear }) {
  return (
    <div className="border border-border rounded-md bg-card p-4 mb-6 flex items-end gap-4 flex-wrap" data-testid="audit-filter-bar">
      <div>
        <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">From</label>
        <input data-testid="audit-start-date" type="date" className={inp} value={start} onChange={(e) => setStart(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">To</label>
        <input data-testid="audit-end-date" type="date" className={inp} value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <button data-testid="audit-apply-filter-btn" onClick={onApply}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border font-medium text-sm hover:bg-muted transition-colors">
        <Filter className="w-4 h-4" /> Apply
      </button>
      {(start || end) && (
        <button data-testid="audit-clear-filter-btn" onClick={onClear} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Clear</button>
      )}
    </div>
  );
}

export function AuditTable({ logs }) {
  if (logs.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-md p-12 text-center text-muted-foreground" data-testid="audit-empty">
        <ScrollText className="w-8 h-8 mx-auto mb-3 text-primary" />
        No activity found for this range.
      </div>
    );
  }
  return (
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
  );
}
