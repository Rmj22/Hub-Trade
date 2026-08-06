import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { HardHat, ArrowRight, Briefcase, Users, Truck, Wrench, FileText, Clock, Check } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";

const TRADE_TILES = [
  { label: "Framing Crews", img: "https://images.unsplash.com/photo-1646324554833-f0b6a479fa5d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwzfHxjb25zdHJ1Y3Rpb24lMjBmcmFtaW5nJTIwY3JldyUyMHdvb2QlMjBmcmFtaW5nfGVufDB8fHx8MTc4NjAzNTgxMXww&ixlib=rb-4.1.0&q=85" },
  { label: "Plumbers", img: "https://images.unsplash.com/photo-1676210134188-4c05dd172f89?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTV8MHwxfHNlYXJjaHwxfHxwbHVtYmVyJTIwd29ya2luZyUyMHBpcGVzfGVufDB8fHx8MTc4NjAzNTgxMXww&ixlib=rb-4.1.0&q=85" },
  { label: "Concrete Workers", img: "https://images.unsplash.com/photo-1651195297119-afc97f14a40d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwyfHxjb25jcmV0ZSUyMHdvcmtlcnMlMjBwb3VyaW5nJTIwY29uY3JldGV8ZW58MHx8fHwxNzg2MDM1ODEyfDA&ixlib=rb-4.1.0&q=85" },
  { label: "Electricians", img: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxOTF8MHwxfHNlYXJjaHwzfHxlbGVjdHJpY2lhbiUyMHdpcmluZyUyMGVsZWN0cmljYWwlMjBwYW5lbHxlbnwwfHx8fDE3ODYwMzU4MTJ8MA&ixlib=rb-4.1.0&q=85" },
];

const PLANS = [
  { key: "startup", name: "Startup", price: 60, link: process.env.REACT_APP_STRIPE_PAYMENT_LINK_STARTUP, feats: ["Up to 20 employees", "3 vehicles", "10 active jobs", "30 equipment pieces", "5 hrs data-entry help"] },
  { key: "medium", name: "Medium", price: 89, popular: true, link: process.env.REACT_APP_STRIPE_PAYMENT_LINK_MEDIUM, feats: ["Up to 50 employees", "10 vehicles", "30 active jobs", "60 equipment pieces", "10 hrs data-entry help"] },
  { key: "large", name: "Large", price: 149, link: process.env.REACT_APP_STRIPE_PAYMENT_LINK_LARGE, feats: ["Up to 100 employees", "20 vehicles", "50 active jobs", "120 equipment pieces", "20 hrs data-entry help"] },
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
            <div className="grid grid-cols-2 gap-3" data-testid="hero-trade-tiles">
              {TRADE_TILES.map((tile, i) => (
                <motion.div
                  key={tile.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
                  className={`group relative rounded-md overflow-hidden border border-border ${i % 2 === 1 ? "mt-6" : ""}`}
                  data-testid={`hero-tile-${tile.label.toLowerCase().split(" ")[0]}`}
                >
                  <img src={tile.img} alt={tile.label} className="w-full h-40 sm:h-48 object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <span className="absolute bottom-2 left-3 text-white font-head font-bold text-sm sm:text-base tracking-tight drop-shadow">{tile.label}</span>
                </motion.div>
              ))}
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
          <p className="text-muted-foreground mb-12">Prices shown monthly.</p>
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
