import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./NotificationBell";
import {
  LayoutDashboard, Briefcase, Users, Truck, Wrench, FileText,
  Clock, MessageSquare, BarChart3, CreditCard, LogOut, Menu, HardHat, X, LifeBuoy, ShieldCheck, ScrollText,
} from "lucide-react";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, roles: ["owner", "foreman", "employee"], end: true },
  { to: "/app/jobs", label: "Jobs", icon: Briefcase, roles: ["owner", "foreman", "employee"] },
  { to: "/app/team", label: "Team", icon: Users, roles: ["owner"] },
  { to: "/app/vehicles", label: "Vehicles", icon: Truck, roles: ["owner", "foreman"] },
  { to: "/app/equipment", label: "Equipment", icon: Wrench, roles: ["owner", "foreman"] },
  { to: "/app/estimates", label: "Estimates", icon: FileText, roles: ["owner", "foreman"] },
  { to: "/app/timecards", label: "Time Cards", icon: Clock, roles: ["owner", "foreman", "employee"] },
  { to: "/app/data-entry", label: "Data-Entry Help", icon: LifeBuoy, roles: ["owner", "foreman", "employee"] },
  { to: "/app/messages", label: "Team Chat", icon: MessageSquare, roles: ["owner", "foreman", "employee"] },
  { to: "/app/reports", label: "Reports", icon: BarChart3, roles: ["owner"] },
  { to: "/app/audit-logs", label: "Audit Logs", icon: ScrollText, roles: ["owner"] },
  { to: "/app/membership", label: "Membership", icon: CreditCard, roles: ["owner"] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const links = NAV.filter((n) => n.roles.includes(user?.role));

  const SideContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-6 h-16 border-b border-border shrink-0">
        <HardHat className="w-6 h-6 text-primary" />
        <span className="font-head font-extrabold text-lg tracking-tight">Hub Trade</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {links.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={() => setOpen(false)}
            data-testid={`nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`
            }
          >
            <n.icon className="w-4 h-4" />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-border">
        {user?.is_superadmin && (
          <NavLink to="/admin-control-241" onClick={() => setOpen(false)} data-testid="nav-admin-control"
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-primary hover:bg-muted w-full transition-colors mb-1">
            <ShieldCheck className="w-4 h-4" /> Admin Control
          </NavLink>
        )}
        <button
          data-testid="logout-btn"
          onClick={async () => { await logout(); nav("/login"); }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground w-full transition-colors"
        >
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="hidden lg:block w-64 border-r border-border bg-card shrink-0">
        <SideContent />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-card border-r border-border">
            <button className="absolute right-3 top-4 z-10" onClick={() => setOpen(false)}><X className="w-5 h-5" /></button>
            <SideContent />
          </aside>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border flex items-center justify-between px-4 lg:px-8 backdrop-blur-xl bg-card/70 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(true)} data-testid="mobile-menu-btn"><Menu className="w-5 h-5" /></button>
            <div>
              <div className="font-head font-bold text-sm sm:text-base leading-tight">{user?.company?.name || "Dashboard"}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{user?.role} · {user?.company?.plan ? `${user.company.plan} plan` : "no plan"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <ThemeToggle />
            <div className="w-9 h-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm" data-testid="user-avatar">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
