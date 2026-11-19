import { useEffect, useLayoutEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, ArrowLeft } from "lucide-react";

export const DASH_TOUR_FLAG = "ht_show_dash_tour";
const DONE_KEY = (id) => `ht_dash_tour_done_${id}`;

const STEPS = [
  { target: null, title: "Welcome to your workspace", body: "You're the Owner. Let's take 60 seconds to show you where everything lives — then you can add your crew and first job." },
  { target: '[data-testid="stat-employees"]', title: "Your dashboard", body: "These tiles update live: equipment and vehicles in use, jobs running behind, upcoming estimates, team size and completed work." },
  { target: '[data-testid="nav-team"]', title: "Add your crew first", body: "Team is where you invite foremen and employees and set their role. Each person logs in with their own account." },
  { target: '[data-testid="nav-jobs"]', title: "Create jobs & assign crews", body: "Add a job, then use Crew on the job card to assign people, vehicles and equipment. They get notified instantly." },
  { target: '[data-testid="nav-schedule"]', title: "See the week at a glance", body: "Schedule shows every job by day or week. Drag a job to move it." },
  { target: '[data-testid="nav-estimates"]', title: "Estimates customers can sign", body: "Build an estimate, email it, and the customer e-signs and pays the deposit online. A signed PDF goes to both of you." },
  { target: '[data-testid="nav-time-cards"]', title: "Time cards, even offline", body: "Your crew clocks in and out from their phones. It works with no signal and syncs later." },
  { target: '[data-testid="nav-membership"]', title: "Your free trial", body: "You're on the Medium plan free for 15 days. Membership is where you pick a plan whenever you're ready — no card needed until then.", cta: { label: "Add your first team member", to: "/app/team" } },
];

function useTargetRect(selector, step) {
  const [rect, setRect] = useState(null);
  useLayoutEffect(() => {
    if (!selector) { setRect(null); return; }
    const el = document.querySelector(selector);
    if (!el || el.offsetParent === null) { setRect(null); return; }
    el.scrollIntoView({ block: "nearest" });
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [selector, step]);
  return rect;
}

export function shouldShowDashTour(user) {
  if (!user || user.role !== "owner") return false;
  try { return localStorage.getItem(DASH_TOUR_FLAG) === "1" && !localStorage.getItem(DONE_KEY(user.id)); } catch { return false; }
}

export default function DashboardTour({ user, forceOpen = false, onClose }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (forceOpen || shouldShowDashTour(user)) { setI(0); setOpen(true); }
  }, [user, forceOpen]);

  const step = STEPS[i];
  const rect = useTargetRect(step.target, i);

  const close = () => {
    try { localStorage.removeItem(DASH_TOUR_FLAG); if (user?.id) localStorage.setItem(DONE_KEY(user.id), "1"); } catch { /* ignore */ }
    setOpen(false);
    onClose?.();
  };

  if (!open) return null;
  const last = i === STEPS.length - 1;
  const pad = 8;
  const popStyle = rect
    ? { position: "fixed", top: Math.max(8, Math.min(rect.top, window.innerHeight - 320)), left: Math.max(8, Math.min(rect.right + 16, window.innerWidth - 376)) }
    : { position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, pointerEvents: "none" };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100]" data-testid="dashboard-tour">
        {rect ? (
          <div className="fixed rounded-md ring-2 ring-primary pointer-events-none transition-all duration-300"
            style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(0,0,0,0.7)" }}
            data-testid="tour-spotlight" />
        ) : <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />}
        <div style={popStyle}>
        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
          className="relative pointer-events-auto w-[min(360px,calc(100vw-2rem))] border border-border rounded-md bg-card p-6 shadow-2xl">
          <button onClick={close} data-testid="tour-skip-btn" aria-label="Skip tour"
            className="absolute right-2 top-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2" data-testid="tour-step-counter">{i + 1} / {STEPS.length}</div>
          <h3 className="font-head font-extrabold text-xl tracking-tight mb-2" data-testid="tour-step-title">{step.title}</h3>
          <p className="text-sm text-muted-foreground mb-5">{step.body}</p>
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0} data-testid="tour-back-btn"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowLeft className="w-4 h-4" /> Back</button>
            {last ? (
              <button onClick={() => { close(); nav(step.cta.to); }} data-testid="tour-finish-btn"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">{step.cta.label} <ArrowRight className="w-4 h-4" /></button>
            ) : (
              <button onClick={() => setI((n) => n + 1)} data-testid="tour-next-btn"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">Next <ArrowRight className="w-4 h-4" /></button>
            )}
          </div>
        </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
