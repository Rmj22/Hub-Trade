import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { HardHat } from "lucide-react";
import { toast } from "sonner";

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await login(email, password); toast.success("Welcome back"); nav("/app"); }
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
            <input data-testid="login-email" className={inp} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input data-testid="login-password" className={inp} placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
    try { await register(form); toast.success("Company created!"); nav("/app/membership"); }
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
          <p className="text-muted-foreground text-sm mb-6">You'll be the Owner of your company workspace.</p>
          <form onSubmit={submit} className="space-y-4">
            <input data-testid="register-name" className={inp} placeholder="Your name" value={form.name} onChange={set("name")} required />
            <input data-testid="register-company" className={inp} placeholder="Company name" value={form.company_name} onChange={set("company_name")} required />
            <input data-testid="register-email" className={inp} placeholder="Email" type="email" value={form.email} onChange={set("email")} required />
            <input data-testid="register-password" className={inp} placeholder="Password" type="password" value={form.password} onChange={set("password")} required />
            <button data-testid="register-submit-btn" disabled={loading} className="w-full py-3 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? "Creating…" : "Create workspace"}
            </button>
          </form>
          <p className="text-sm text-muted-foreground mt-6 text-center">
            Have an account? <Link to="/login" className="text-primary font-semibold" data-testid="to-login-link">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
