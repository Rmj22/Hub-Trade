import { WifiOff, RefreshCw, CloudUpload } from "lucide-react";
import { useOffline } from "../lib/offline";
import { useState } from "react";
import { toast } from "sonner";

export default function OfflineBanner() {
  const { online, pending, sync } = useOffline();
  const [busy, setBusy] = useState(false);
  if (online && pending === 0) return null;

  const doSync = async () => {
    setBusy(true);
    const r = await sync();
    setBusy(false);
    if (r.synced) toast.success(`Synced ${r.synced} offline action${r.synced === 1 ? "" : "s"}`);
    if (r.failed) toast.error(`${r.failed} action${r.failed === 1 ? "" : "s"} could not sync`);
  };

  return (
    <div data-testid="offline-banner" className={`flex items-center gap-3 px-4 py-2 text-sm border-b ${online ? "bg-primary/10 border-primary/30" : "bg-amber-500/15 border-amber-500/40"}`}>
      {online ? <CloudUpload className="w-4 h-4 text-primary" /> : <WifiOff className="w-4 h-4 text-amber-500" />}
      <span className="flex-1">
        {online ? `${pending} change${pending === 1 ? "" : "s"} waiting to sync` : "You're offline — clock-ins and photos are saved on this device and will sync when signal returns."}
        {!online && pending > 0 && <span className="font-semibold"> ({pending} pending)</span>}
      </span>
      {online && (
        <button onClick={doSync} disabled={busy} data-testid="offline-sync-btn" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60">
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} /> Sync now
        </button>
      )}
    </div>
  );
}
