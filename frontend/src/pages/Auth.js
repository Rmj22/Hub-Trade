import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { HardHat } from "lucide-react";
import { toast } from "sonner";
import { saveLogin, loadLogin, clearLogin } from "../lib/savedLogin";
import { DASH_TOUR_FLAG } from "../components/DashboardTour";

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const saved = loadLogin();
  const [email, setEmail] = useState(saved?.email || "");
  const [password, setPassword] = useState(saved?.password || "");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      if (remember) saveLogin(email, password); else clearLogin();
      toast.success("Welcome back"); nav("/app");
    }
    catch (err) { toast.error(err.message); }
    setLoading(false);
  };

  const inp = "w-full px-4 py-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none";
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <HardHat className="w-7 h-7 text-primary" />
          <span className="font-head font-extrabold text-2xl tracking-tight">Hub Trade</span>
        </Link>
        <div className="border border-border rounded-md bg-card p-8">
          <h1 className="font-head font-extrabold text-3xl mb-2 tracking-tight">Log in</h1>
          <p className="text-muted-foreground text-sm mb-6">Manage your crew, jobs, and gear.</p>
          <form onSubmit={submit} className="space-y-4">
            <input data-testid="login-email" className={inp} placeholder="Email" type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input data-testid="login-password" className={inp} placeholder="Password" type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input type="checkbox" data-testid="login-remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-primary w-4 h-4" />
              Remember me on this device
            </label>
            <button data-testid="login-submit-btn" disabled={loading} className="w-full py-3 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>
          <p className="text-sm text-muted-foreground mt-6 text-center">
            No account? <Link to="/register" className="text-primary font-semibold" data-testid="to-register-link">Start free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", company_name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form); saveLogin(form.email, form.password);
      try { localStorage.setItem(DASH_TOUR_FLAG, "1"); } catch { /* ignore */ }
      toast.success("Company created!"); nav("/app");
    }
    catch (err) { toast.error(err.message); }
    setLoading(false);
  };

  const inp = "w-full px-4 py-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none";
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <HardHat className="w-7 h-7 text-primary" />
          <span className="font-head font-extrabold text-2xl tracking-tight">Hub Trade</span>
        </Link>
        <div className="border border-border rounded-md bg-card p-8">
          <h1 className="font-head font-extrabold text-3xl mb-2 tracking-tight">Start free</h1>
          <p className="text-muted-foreground text-sm mb-6">15-day free trial of the Medium plan — no card, no code. You'll be the Owner of your company workspace.</p>
          <form onSubmit={submit} className="space-y-4">
            <input data-testid="register-name" className={inp} placeholder="Your name" value={form.name} onChange={set("name")} required />
            <input data-testid="register-company" className={inp} placeholder="Company name" value={form.company_name} onChange={set("company_name")} required />
            <input data-testid="register-email" className={inp} placeholder="Email" type="email" name="email" autoComplete="username" value={form.email} onChange={set("email")} required />
            <input data-testid="register-password" className={inp} placeholder="Password" type="password" name="password" autoComplete="new-password" value={form.password} onChange={set("password")} required />
            <p className="text-xs text-muted-foreground">Your email and password are saved on this device so you can log in with one tap.</p>
            <button data-testid="register-submit-btn" disabled={loading} className="w-full py-3 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? "Creating…" : "Create workspace"}
            </button>
            <p className="text-xs text-muted-foreground text-center">
              By creating a workspace you agree to our <a href="/privacy-policy.html" target="_blank" rel="noreferrer" data-testid="register-privacy-link" className="underline underline-offset-4 hover:text-foreground">Privacy Policy</a>.
            </p>
          </form>
          <p className="text-sm text-muted-foreground mt-6 text-center">
            Have an account? <Link to="/login" className="text-primary font-semibold" data-testid="to-login-link">Log in</Link> · <Link to="/user-guide" className="text-primary font-semibold" data-testid="register-guide-link">User guide</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
