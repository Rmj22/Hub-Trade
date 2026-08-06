import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

const PAYMENT_LINKS = {
  startup: process.env.REACT_APP_STRIPE_PAYMENT_LINK_STARTUP,
  medium: process.env.REACT_APP_STRIPE_PAYMENT_LINK_MEDIUM,
  large: process.env.REACT_APP_STRIPE_PAYMENT_LINK_LARGE,
};

const PLANS = [
  { key: "startup", name: "Startup", price: 60, feats: ["20 employees", "3 vehicles", "10 active jobs", "30 equipment", "5 hrs data-entry"] },
  { key: "medium", name: "Medium", price: 89, popular: true, feats: ["50 employees", "10 vehicles", "30 active jobs", "60 equipment", "10 hrs data-entry"] },
  { key: "large", name: "Large", price: 149, feats: ["100 employees", "20 vehicles", "50 active jobs", "120 equipment", "20 hrs data-entry"] },
];

export function MembershipPage() {
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(null);
  const current = user?.company?.plan;
  const active = user?.company?.membership_status === "active";

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const checkout = async (plan) => {
    if (PAYMENT_LINKS[plan]) { window.location.href = PAYMENT_LINKS[plan]; return; }
    setLoading(plan);
    try {
      const { data } = await api.post("/payments/checkout", { plan, origin_url: window.location.origin });
      window.location.href = data.checkout_url;
    } catch (e) { toast.error(errMsg(e)); setLoading(null); }
  };

  return (
    <div data-testid="membership-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Membership</div>
        <h1 className="font-head font-extrabold text-3xl sm:text-4xl tracking-tight">Choose your plan</h1>
        <p className="text-muted-foreground mt-2">Billed every 6 months. {active && <span className="text-primary font-semibold">Current: {current} (active)</span>}</p>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((p) => {
          const isCurrent = active && current === p.key;
          return (
            <div key={p.key} data-testid={`membership-plan-${p.key}`} className={`relative border rounded-md p-8 bg-card ${p.popular ? "border-primary" : "border-border"}`}>
              {p.popular && <div className="absolute -top-3 left-8 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">Popular</div>}
              <h3 className="font-head font-bold text-xl mb-1">{p.name}</h3>
              <div className="flex items-baseline gap-1"><span className="font-head font-extrabold text-4xl">${p.price}</span><span className="text-muted-foreground text-sm">/mo</span></div>
              <div className="text-xs text-muted-foreground mb-6">${p.price * 6} billed every 6 months</div>
              <ul className="space-y-2 mb-8">
                {p.feats.map((f) => <li key={f} className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-primary shrink-0" />{f}</li>)}
              </ul>
              <button
                data-testid={`checkout-${p.key}-btn`}
                disabled={loading || isCurrent}
                onClick={() => checkout(p.key)}
                className={`w-full py-3 rounded-md font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 ${p.popular ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                {loading === p.key ? <Loader2 className="w-4 h-4 animate-spin" /> : isCurrent ? "Current plan" : `Choose ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PaymentSuccess() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const sid = params.get("session_id");
    if (!sid) { setStatus("error"); return; }
    let tries = 0;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${sid}`);
        if (data.payment_status === "paid") { setStatus("paid"); await refresh(); return; }
        if (data.status === "expired" || tries > 8) { setStatus("error"); return; }
      } catch { if (tries > 8) { setStatus("error"); return; } }
      tries += 1; setTimeout(poll, 2000);
    };
    poll();
    // eslint-disable-next-line
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background" data-testid="payment-success-page">
      <div className="border border-border rounded-md bg-card p-10 max-w-md text-center">
        {status === "checking" && <><Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" /><h1 className="font-head font-bold text-xl">Confirming payment…</h1></>}
        {status === "paid" && <>
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4"><Check className="w-7 h-7 text-primary" /></div>
          <h1 className="font-head font-extrabold text-2xl mb-2">Membership active!</h1>
          <p className="text-muted-foreground text-sm mb-6">Your plan is live. Time to build.</p>
          <button data-testid="go-to-dashboard-btn" onClick={() => nav("/app")} className="px-6 py-3 rounded-md bg-primary text-primary-foreground font-semibold">Go to dashboard</button>
        </>}
        {status === "error" && <>
          <h1 className="font-head font-bold text-xl mb-2">Payment not confirmed</h1>
          <p className="text-muted-foreground text-sm mb-6">If you completed checkout, refresh in a moment.</p>
          <button onClick={() => nav("/app/membership")} className="px-6 py-3 rounded-md border border-border font-semibold">Back to plans</button>
        </>}
      </div>
    </div>
  );
}
