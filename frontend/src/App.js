import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import { LoginPage, RegisterPage } from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import { JobsPage, VehiclesPage, EquipmentPage } from "./pages/Resources";
import TeamPage from "./pages/Team";
import EstimatesPage from "./pages/Estimates";
import TimeCardsPage from "./pages/TimeCards";
import MessagesPage from "./pages/Messages";
import ReportsPage from "./pages/Reports";
import AuditLogsPage from "./pages/AuditLogs";
import DataEntryPage from "./pages/DataEntry";
import AdminControl from "./pages/AdminControl";
import { MembershipPage, PaymentSuccess } from "./pages/Membership";
import { Loader2 } from "lucide-react";

function Protected({ children, roles }) {
  const { user } = useAuth();
  if (user === null) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (user === false) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/app" element={<Protected><Dashboard /></Protected>} />
          <Route path="/app/jobs" element={<Protected><JobsPage /></Protected>} />
          <Route path="/app/team" element={<Protected roles={["owner"]}><TeamPage /></Protected>} />
          <Route path="/app/vehicles" element={<Protected roles={["owner", "foreman"]}><VehiclesPage /></Protected>} />
          <Route path="/app/equipment" element={<Protected roles={["owner", "foreman"]}><EquipmentPage /></Protected>} />
          <Route path="/app/estimates" element={<Protected roles={["owner", "foreman"]}><EstimatesPage /></Protected>} />
          <Route path="/app/timecards" element={<Protected><TimeCardsPage /></Protected>} />
          <Route path="/app/data-entry" element={<Protected><DataEntryPage /></Protected>} />
          <Route path="/app/messages" element={<Protected><MessagesPage /></Protected>} />
          <Route path="/app/reports" element={<Protected roles={["owner"]}><ReportsPage /></Protected>} />
          <Route path="/app/audit-logs" element={<Protected roles={["owner"]}><AuditLogsPage /></Protected>} />
          <Route path="/app/membership" element={<Protected roles={["owner"]}><MembershipPage /></Protected>} />
          <Route path="/admin-control-241" element={<AdminControl />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
