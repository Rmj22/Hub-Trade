import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, API, errMsg } from "../lib/api";
import { toast, Toaster } from "sonner";
import { HardHat, CheckCircle2, PenLine, CreditCard, Loader2, FileDown } from "lucide-react";

const money = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const POLL_MS = 2000;
const MAX_POLLS = 10;

function LineItems({ items, total }) {
  return (
    <table className="w-full text-sm" data-testid="public-line-items">
      <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
        <th className="py-2">Item</th><th className="py-2 text-center">Qty</th><th className="py-2 text-right">Unit</th><th className="py-2 text-right">Total</th>
      </tr></thead>
      <tbody>
        {items.map((li, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <td className="py-2.5 pr-3">{li.desc}</td>
            <td className="py-2.5 text-center">{li.qty}</td>
            <td className="py-2.5 text-right">{money(li.unit_price)}</td>
            <td className="py-2.5 text-right">{money((li.qty || 0) * (li.unit_price || 0))}</td>
          </tr>
        ))}
      </tbody>
      <tfoot><tr><td colSpan={3} className="pt-4 text-right font-semibold">Total</td><td className="pt-4 text-right font-head font-extrabold text-xl" data-testid="public-total">{money(total)}</td></tr></tfoot>
    </table>
  );
}

function ApproveBox({ onApprove, busy }) {
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  return (
    <div className="border border-border rounded-md bg-card p-6" data-testid="approve-box">
      <div className="flex items-center gap-2 mb-1"><PenLine className="w-5 h-5 text-primary" /><h2 className="font-head font-bold text-lg">Approve this estimate</h2></div>
      <p className="text-sm text-muted-foreground mb-4">Type your full name below as your electronic signature.</p>
      <input data-testid="signature-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
        className="w-full px-3 py-3 rounded-md border border-input bg-background text-lg font-[cursive] italic focus:ring-2 focus:ring-primary focus:outline-none" />
      <label className="flex items-start gap-2 text-sm mt-4 cursor-pointer">
        <input type="checkbox" data-testid="agree-checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
        <span>I agree to the scope and pricing above and understand this electronic signature is legally binding.</span>
      </label>
      <button data-testid="approve-btn" disabled={busy || name.trim().length < 2 || !agree} onClick={() => onApprove(name.trim())}
        className="w-full mt-5 py-3 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve & sign
      </button>
    </div>
  );
}

function DepositBox({ est, onPay, busy, checking }) {
  if (est.deposit_paid) {
    return (
      <div className="border border-green-500/40 bg-green-500/10 rounded-md p-6 flex items-center gap-3" data-testid="deposit-paid">
        <CheckCircle2 className="w-6 h-6 text-green-500" />
        <div><div className="font-semibold">Deposit of {money(est.deposit_amount)} received</div><div className="text-sm text-muted-foreground">Thank you — you're on the schedule.</div></div>
      </div>
    );
  }
  if (est.deposit_amount <= 0) return null;
  return (
    <div className="border border-border rounded-md bg-card p-6" data-testid="deposit-box">
      <div className="flex items-center gap-2 mb-1"><CreditCard className="w-5 h-5 text-primary" /><h2 className="font-head font-bold text-lg">Pay your deposit</h2></div>
      <p className="text-sm text-muted-foreground mb-4">{est.deposit_percent}% deposit to secure your spot. Secure card payment via Stripe.</p>
      <button data-testid="pay-deposit-btn" disabled={busy || checking} onClick={onPay}
        className="w-full py-3 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2">
        {busy || checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />} {checking ? "Confirming payment…" : `Pay ${money(est.deposit_amount)} deposit`}
      </button>
    </div>
  );
}

export default function PublicEstimatePage() {
  const { token } = useParams();
  const [params, setParams] = useSearchParams();
  const [est, setEst] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(!!params.get("session_id"));

  const load = useCallback(() => api.get(`/public/estimates/${token}`).then((r) => setEst(r.data)).catch((e) => setError(errMsg(e))), [token]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const sid = params.get("session_id");
    if (!sid) return;
    let tries = 0, cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const { data } = await api.get(`/payments/status/${sid}`);
        if (data.payment_status === "paid") { toast.success("Deposit received — thank you!"); setChecking(false); setParams({}); load(); return; }
      } catch { /* retry */ }
      if (++tries >= MAX_POLLS) { setChecking(false); toast.error("Payment still processing. Refresh in a moment."); return; }
      setTimeout(poll, POLL_MS);
    };
    poll();
    return () => { cancelled = true; };
  }, [params, setParams, load]);

  const approve = async (signature_name) => {
    setBusy(true);
    try { const { data } = await api.post(`/public/estimates/${token}/approve`, { signature_name }); setEst(data); toast.success("Estimate approved"); }
    catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  const pay = async () => {
    setBusy(true);
    try { const { data } = await api.post(`/public/estimates/${token}/deposit`, { origin_url: window.location.origin }); window.location.href = data.checkout_url; }
    catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="public-estimate-page">
      <Toaster position="top-right" richColors />
      <header className="h-16 border-b border-border flex items-center px-6 gap-2"><HardHat className="w-6 h-6 text-primary" /><span className="font-head font-extrabold text-lg tracking-tight">Hub Trade</span></header>
      <main className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">
        {error && <div className="border border-destructive/40 bg-destructive/10 rounded-md p-6 text-center" data-testid="public-error">{error}</div>}
        {!est && !error && <div className="text-muted-foreground">Loading…</div>}
        {est && (
          <>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Estimate from</div>
                <h1 className="font-head font-extrabold text-3xl sm:text-4xl tracking-tight" data-testid="public-company">{est.company_name}</h1>
                <p className="text-muted-foreground mt-1">Prepared for <span className="font-semibold text-foreground" data-testid="public-customer">{est.customer_name}</span></p>
              </div>
              <a href={`${API}/public/estimates/${token}/pdf`} target="_blank" rel="noreferrer" data-testid="public-pdf-btn"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors">
                <FileDown className="w-4 h-4" /> {est.status === "approved" ? "Download signed PDF" : "Download PDF"}
              </a>
            </div>
            <div className="border border-border rounded-md bg-card p-6"><LineItems items={est.line_items} total={est.total} /></div>
            {est.notes && <div className="border border-border rounded-md bg-card p-6 text-sm whitespace-pre-wrap" data-testid="public-notes">{est.notes}</div>}
            {est.status === "approved" ? (
              <div className="border border-green-500/40 bg-green-500/10 rounded-md p-6 flex items-center gap-3" data-testid="approved-badge">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                <div><div className="font-semibold">Approved & signed by {est.signature_name}</div><div className="text-sm text-muted-foreground">{new Date(est.approved_at).toLocaleString()}</div></div>
              </div>
            ) : <ApproveBox onApprove={approve} busy={busy} />}
            {est.status === "approved" && <DepositBox est={est} onPay={pay} busy={busy} checking={checking} />}
          </>
        )}
      </main>
    </div>
  );
}
