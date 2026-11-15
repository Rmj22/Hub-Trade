import { Link, useLocation, Navigate } from "react-router-dom";
import { Clock, Archive } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function TrialBanner() {
  const { user } = useAuth();
  const loc = useLocation();
  const c = user?.company;
  if (!c || user?.is_superadmin) return null;

  if (c.membership_status === "archived") {
    if (!loc.pathname.startsWith("/app/membership")) return <Navigate to="/app/membership" replace />;
    return (
      <div data-testid="archived-banner" className="flex items-center gap-3 px-4 py-2 text-sm border-b bg-destructive/10 border-destructive/40">
        <Archive className="w-4 h-4 text-destructive" />
        <span className="flex-1">Trial ended — account archived. Your data is kept for <b>{c.days_until_removal} day{c.days_until_removal === 1 ? "" : "s"}</b>; choose a plan to reactivate.</span>
      </div>
    );
  }

  if (c.membership_status === "trial" && user?.role === "owner") {
    const d = c.trial_days_left;
    return (
      <div data-testid="trial-banner" className={`flex items-center gap-3 px-4 py-2 text-sm border-b ${d <= 5 ? "bg-amber-500/15 border-amber-500/40" : "bg-primary/10 border-primary/30"}`}>
        <Clock className={`w-4 h-4 ${d <= 5 ? "text-amber-500" : "text-primary"}`} />
        <span className="flex-1">Free trial · <b>{d} day{d === 1 ? "" : "s"} left</b> on the Medium plan.</span>
        <Link to="/app/membership" data-testid="trial-banner-upgrade" className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold">Choose a plan</Link>
      </div>
    );
  }
  return null;
}
