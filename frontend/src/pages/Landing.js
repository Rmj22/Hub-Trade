import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { HardHat, ArrowRight, Briefcase, Users, Truck, Wrench, FileText, Clock, Check } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";

const HERO = "https://images.unsplash.com/photo-1697305592218-d5d0c1bab2e3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzh8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBjb25zdHJ1Y3Rpb24lMjB3b3JrZXIlMjB1c2luZyUyMHRhYmxldHxlbnwwfHx8fDE3ODU0Mzg4ODJ8MA&ixlib=rb-4.1.0&q=85";

const PLANS = [
  { key: "startup", name: "Startup", price: 60, link: "https://buy.stripe.com/14A00k8Qn72s8yLghw38402", feats: ["Up to 20 employees", "3 vehicles", "10 active jobs", "30 equipment pieces", "5 hrs data-entry help"] },
  { key: "medium", name: "Medium", price: 89, popular: true, link: "https://buy.stripe.com/6oUdRa0jR2MceX94yO38401", feats: ["Up to 50 employees", "10 vehicles", "30 active jobs", "60 equipment pieces", "10 hrs data-entry help"] },
  { key: "large", name: "Large", price: 149, link: "https://buy.stripe.com/8x26oId6D9aA02f0iy38400", feats: ["Up to 100 employees", "20 vehicles", "50 active jobs", "120 equipment pieces", "20 hrs data-entry help"] },
];

const FEATURES = [
  { icon: Briefcase, t: "Jobs & Crews", d: "Assign crews, vehicles and equipment to every job in seconds." },
  { icon: Clock, t: "Time Cards", d: "Employees clock in/out on site. Labor hours tracked automatically." },
  { icon: FileText, t: "On-site Estimates", d: "Build estimates with photos and email them straight to customers." },
  { icon: Truck, t: "Fleet Maintenance", d: "Oil changes, registration, insurance and inspection reminders." },
  { icon: Wrench, t: "Equipment Tracking", d: "Inspection dates, repair history, service reminders and hours." },
  { icon: Users, t: "Role-based Access", d: "Owner, Foreman and Employee — everyone sees what they need." },
];

export default function Landing() {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardHat className="w-6 h-6 text-primary" />
            <span className="font-head font-extrabold text-xl tracking-tight">Hub Trade</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login" data-testid="landing-login-link" className="text-sm font-medium hover:text-primary transition-colors">Log in</Link>
            <Link to="/register" data-testid="landing-cta-nav" className="text-sm font-semibold px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity">Start free</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-28 pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-10 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6">
              Built for trades
            </div>
            <h1 className="font-head text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05] mb-6">
              <span className="font-light">Run your entire</span><br />
              <span className="font-extrabold">field business</span> <span className="font-extrabold text-primary">from one app.</span>
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-xl mb-8">
              Jobs, crews, vehicles, equipment, estimates and time cards — organized for small construction and trade companies. Data-entry help included.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/register" data-testid="hero-cta-btn" className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
                Start free <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#pricing" className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-border font-semibold hover:bg-muted transition-colors">See pricing</a>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7 }} className="lg:col-span-5">
            <div className="relative rounded-md overflow-hidden border border-border">
              <img src={HERO} alt="Construction worker using tablet" className="w-full h-[380px] object-cover" />
              <div className="absolute inset-0 bg-black/20" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-head font-extrabold text-2xl sm:text-3xl lg:text-4xl tracking-tight mb-12">Everything your crew needs.</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div key={f.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="border border-border rounded-md p-6 bg-card hover:-translate-y-1 transition-transform">
                <f.icon className="w-6 h-6 text-primary mb-4" />
                <h3 className="font-head font-bold text-lg mb-2">{f.t}</h3>
                <p className="text-muted-foreground text-sm">{f.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Membership</div>
          <h2 className="font-head font-extrabold text-2xl sm:text-3xl lg:text-4xl tracking-tight mb-2">Simple plans. Billed every 6 months.</h2>
          <p className="text-muted-foreground mb-12">Prices shown monthly. You're billed the 6-month total up front.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((p) => (
              <div key={p.key} data-testid={`plan-${p.key}`} className={`relative border rounded-md p-8 bg-card ${p.popular ? "border-primary" : "border-border"}`}>
                {p.popular && <div className="absolute -top-3 left-8 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">Most popular</div>}
                <h3 className="font-head font-bold text-xl mb-1">{p.name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-head font-extrabold text-4xl">${p.price}</span>
                  <span className="text-muted-foreground text-sm">/mo</span>
                </div>
                <div className="text-xs text-muted-foreground mb-6">${p.price * 6} billed every 6 months</div>
                <ul className="space-y-3 mb-8">
                  {p.feats.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />{f}</li>
                  ))}
                </ul>
                <a href={p.link} data-testid={`plan-${p.key}-cta`} className={`block text-center py-3 rounded-md font-semibold transition-opacity hover:opacity-90 ${p.popular ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                  Get {p.name}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10 px-4 sm:px-6 text-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2 justify-center mb-2"><HardHat className="w-5 h-5 text-primary" /><span className="font-head font-bold">Hub Trade</span></div>
        Manage every part of your trade business from one platform.
      </footer>
    </div>
  );
}
