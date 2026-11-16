import { Link } from "react-router-dom";
import { HardHat, ArrowLeft, Briefcase, Users, Truck, Wrench, FileText, Clock, CalendarDays, MessageSquare, CreditCard, BarChart3, WifiOff, LifeBuoy } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";

const SECTIONS = [
  { id: "getting-started", icon: HardHat, title: "Getting started", roles: "Everyone", steps: [
    "Click Start free and enter your name, company name, email and password. You become the Owner of your company workspace.",
    "Every new company gets the Medium plan free for 15 days — no card, no code required.",
    "Your sign-in details are remembered on this device so the Log in page is pre-filled next time.",
    "Add your crew from Team → Add member. Each person gets a role: Owner, Foreman or Employee.",
  ] },
  { id: "roles", icon: Users, title: "Roles & permissions", roles: "Owner", steps: [
    "Owner — full access: team, membership, reports, audit logs and everything below.",
    "Foreman — manages jobs, schedule, vehicles, equipment, estimates and time cards.",
    "Employee — sees assigned jobs and the schedule, clocks in/out, chats with the team.",
  ] },
  { id: "jobs", icon: Briefcase, title: "Jobs & crew assignment", roles: "Owner · Foreman", steps: [
    "Jobs → New job. Add the customer, address, dates and status.",
    "Open a job and click Crew to assign employees, vehicles and equipment. Assigned people get a notification.",
    "Use Photos on a job to attach site pictures; they upload later if you're offline.",
  ] },
  { id: "schedule", icon: CalendarDays, title: "Schedule", roles: "Everyone", steps: [
    "Switch between Day and Week views to see every job and who's on it.",
    "Owners and foremen can drag a job to a new day to reschedule it.",
  ] },
  { id: "timecards", icon: Clock, title: "Time cards", roles: "Everyone", steps: [
    "Employees tap Clock in when they arrive and Clock out when they leave, choosing the job they're on.",
    "Owners and foremen see hours per person and per job and can correct entries.",
  ] },
  { id: "offline", icon: WifiOff, title: "Working offline", roles: "Everyone", steps: [
    "Jobs, crew lists and time cards you've already opened stay available with no signal.",
    "Clock in/out and photos are queued and sync automatically once you're back online. A banner shows the offline state.",
  ] },
  { id: "estimates", icon: FileText, title: "Estimates & customer approval", roles: "Owner · Foreman", steps: [
    "Estimates → New estimate. Add line items, notes, photos and an optional deposit amount.",
    "Click Send to email the customer a secure link. They review, type their name as an e-signature and approve.",
    "If a deposit is set, the customer pays it by card right after approving. A signed, branded PDF is emailed to both of you and can be downloaded any time.",
  ] },
  { id: "fleet", icon: Truck, title: "Vehicles & equipment", roles: "Owner · Foreman", steps: [
    "Add each vehicle with mileage, registration, insurance and inspection dates. Log oil changes and repairs.",
    "Equipment works the same way: hours, inspection dates and service history, with reminders when something is due.",
  ] },
  { id: "chat", icon: MessageSquare, title: "Team chat & notifications", roles: "Everyone", steps: [
    "Team Chat is a company-wide channel for quick updates.",
    "The bell icon shows assignments, reminders and approvals as they happen.",
  ] },
  { id: "reports", icon: BarChart3, title: "Reports & audit logs", roles: "Owner", steps: [
    "Reports summarize labor hours, job status and fleet costs.",
    "Audit Logs record who changed what and when, across the whole workspace.",
  ] },
  { id: "data-entry", icon: LifeBuoy, title: "Data-entry help", roles: "Everyone", steps: [
    "Each plan includes hours of data-entry help. Send us your spreadsheets or paperwork from Data-Entry Help and we load them for you.",
  ] },
  { id: "membership", icon: CreditCard, title: "Membership & billing", roles: "Owner", steps: [
    "Plans: Startup $60/mo, Medium $89/mo, Large $149/mo — billed monthly. Choose one from Membership at any time, even during the trial.",
    "5 days before the trial ends you'll get an email reminder. When it ends, the account is archived for 5 days — pick a plan to unlock it instantly. Unpaid archived accounts are removed after 5 days.",
  ] },
];

export default function UserGuide() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="guide-home-link"><HardHat className="w-6 h-6 text-primary" /><span className="font-head font-extrabold text-xl tracking-tight">Hub Trade</span></Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login" className="text-sm font-medium hover:text-primary transition-colors" data-testid="guide-login-link">Log in</Link>
            <Link to="/register" className="text-sm font-semibold px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity" data-testid="guide-register-link">Start free</Link>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 grid lg:grid-cols-12 gap-10" data-testid="user-guide-page">
        <aside className="lg:col-span-3 lg:sticky lg:top-24 self-start">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="w-4 h-4" /> Back</Link>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">Contents</div>
          <nav className="space-y-1">
            {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className="block text-sm text-muted-foreground hover:text-foreground py-1" data-testid={`guide-toc-${s.id}`}>{s.title}</a>)}
          </nav>
        </aside>
        <div className="lg:col-span-9">
          <h1 className="font-head text-4xl sm:text-5xl lg:text-6xl tracking-tight mb-4"><span className="font-light">Hub Trade</span> <span className="font-extrabold">User Guide</span></h1>
          <p className="text-muted-foreground text-base sm:text-lg mb-12 max-w-2xl">Everything you need to set up your company, run jobs and get paid. Written for owners, foremen and crews.</p>
          <div className="space-y-12">
            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24" data-testid={`guide-section-${s.id}`}>
                <div className="flex items-center gap-3 mb-1"><s.icon className="w-5 h-5 text-primary" /><h2 className="font-head font-bold text-base md:text-lg">{s.title}</h2></div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4 ml-8">{s.roles}</div>
                <ol className="space-y-3 ml-8">
                  {s.steps.map((st, idx) => (
                    <li key={st} className="flex gap-3 text-sm sm:text-base"><span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center mt-0.5">{idx + 1}</span><span className="text-muted-foreground">{st}</span></li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
          <div className="mt-16 border border-border rounded-md p-6 bg-card flex flex-wrap items-center justify-between gap-4">
            <div><div className="font-head font-bold">Still stuck?</div><div className="text-sm text-muted-foreground">Email us and we'll walk you through it.</div></div>
            <a href="mailto:admin@summitofficesolution.com" className="px-5 py-2.5 rounded-md border border-border font-semibold hover:bg-muted transition-colors" data-testid="guide-contact-link">Contact support</a>
          </div>
        </div>
      </main>
    </div>
  );
}
