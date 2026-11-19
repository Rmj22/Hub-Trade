import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { HardHat, Briefcase, Users, Clock, FileText, Truck, Gift, X, ArrowRight, ArrowLeft, BookOpen } from "lucide-react";

export const TUTORIAL_KEY = "ht_tutorial_seen";

const STEPS = [
  { icon: HardHat, title: "Welcome to Hub Trade", body: "Run your whole field business from one app — jobs, crews, trucks, gear, estimates and time cards. This 60-second tour shows you how it works." },
  { icon: Briefcase, title: "Jobs & Schedule", body: "Create a job, set its dates, then assign employees, vehicles and equipment right from the job screen. The Schedule calendar shows who's where, by day or by week." },
  { icon: Users, title: "Your crew, their roles", body: "Owners control everything. Foremen manage jobs, gear and estimates. Employees see their jobs and clock in. Everyone gets notified when they're assigned." },
  { icon: Clock, title: "Time cards that work on site", body: "Crews clock in and out from their phone — even with no signal. Hours sync automatically when they're back online." },
  { icon: FileText, title: "Estimates customers can sign", body: "Build an estimate with photos, email it, and the customer approves with an e-signature and pays the deposit online. A signed, branded PDF is created for both of you." },
  { icon: Truck, title: "Fleet & equipment reminders", body: "Oil changes, registration, insurance, inspections and repairs — tracked with reminders so nothing slips." },
  { icon: Gift, title: "Start free for 15 days", body: "Every new company gets the Medium plan free for 15 days. No card, no code. Pick a plan anytime from the Membership page." },
];

export default function WelcomeTutorial({ forceOpen = false, onClose }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (forceOpen) { setI(0); setOpen(true); return; }
    try { if (!localStorage.getItem(TUTORIAL_KEY)) setOpen(true); } catch { /* ignore */ }
  }, [forceOpen]);

  const close = () => {
    try { localStorage.setItem(TUTORIAL_KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
    onClose?.();
  };

  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" data-testid="welcome-tutorial">
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className="relative w-full max-w-lg border border-border rounded-md bg-card p-8 shadow-2xl">
            <button onClick={close} data-testid="tutorial-skip-btn" aria-label="Skip tutorial"
              className="absolute right-3 top-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4" data-testid="tutorial-step-counter">Step {i + 1} of {STEPS.length}</div>
            <step.icon className="w-10 h-10 text-primary mb-4" />
            <h2 className="font-head font-extrabold text-2xl sm:text-3xl tracking-tight mb-3" data-testid="tutorial-step-title">{step.title}</h2>
            <p className="text-muted-foreground text-sm sm:text-base mb-8">{step.body}</p>
            <div className="flex gap-1.5 mb-6">
              {STEPS.map((s, idx) => <span key={s.title} className={`h-1 flex-1 rounded-full ${idx <= i ? "bg-primary" : "bg-muted"}`} />)}
            </div>
            <div className="flex items-center justify-between gap-3">
              <button onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0} data-testid="tutorial-back-btn"
                className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
              <div className="flex items-center gap-3">
                <Link to="/user-guide" onClick={close} data-testid="tutorial-guide-link" className="hidden sm:inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><BookOpen className="w-4 h-4" /> User guide</Link>
                {last ? (
                  <Link to="/register" onClick={close} data-testid="tutorial-finish-btn"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">Start free <ArrowRight className="w-4 h-4" /></Link>
                ) : (
                  <button onClick={() => setI((n) => n + 1)} data-testid="tutorial-next-btn"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">Next <ArrowRight className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
