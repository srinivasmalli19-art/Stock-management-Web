import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import AppShell from "./components/layout/AppShell";
import LoginPage from "./pages/auth/LoginPage";

// Engineer
import EngDashboard from "./pages/engineer/EngDashboard";
import EngProductivity from "./pages/engineer/EngProductivity";
import EngApprovalStatus from "./pages/engineer/EngApprovalStatus";
import EngVanStock from "./pages/engineer/EngVanStock";
import EngLPRequests from "./pages/engineer/EngLPRequests";

// Team Leader
import TLDashboard from "./pages/teamleader/TLDashboard";
import TLValidationQueue from "./pages/teamleader/TLValidationQueue";
import TLLPRequests from "./pages/teamleader/TLLPRequests";

// Store Manager
import StoreDashboard from "./pages/storemanager/StoreDashboard";
import StorePurchaseInward from "./pages/storemanager/StorePurchaseInward";
import StoreStockRequests from "./pages/storemanager/StoreStockRequests";
import StoreInventoryReport from "./pages/storemanager/StoreInventoryReport";
import StoreLPRequests from "./pages/storemanager/StoreLPRequests";

// Admin
import AdminApprovals from "./pages/admin/AdminApprovals";
import AdminPurchaseApprovals from "./pages/admin/AdminPurchaseApprovals";
import AdminRevokeApprovals from "./pages/admin/AdminRevokeApprovals";
import AdminAttendance from "./pages/admin/AdminAttendance";
import AdminInventory from "./pages/admin/AdminInventory";
import AdminPLReport from "./pages/admin/AdminPLReport";
import AdminSkuRegistry from "./pages/admin/AdminSkuRegistry";
import AdminUserRegistry from "./pages/admin/AdminUserRegistry";
import AdminLPApprovals from "./pages/admin/AdminLPApprovals";

function RoleRedirect() {
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            {/* Engineer */}
            <Route path="/engineer/dashboard" element={<EngDashboard />} />
            <Route path="/engineer/productivity" element={<EngProductivity />} />
            <Route path="/engineer/status" element={<EngApprovalStatus />} />
            <Route path="/engineer/stock" element={<EngVanStock />} />
            <Route path="/engineer/lp-requests" element={<EngLPRequests />} />

            {/* Team Leader */}
            <Route path="/tl/dashboard" element={<TLDashboard />} />
            <Route path="/tl/approvals" element={<TLValidationQueue />} />
            <Route path="/tl/lp-requests" element={<TLLPRequests />} />

            {/* Store Manager */}
            <Route path="/store/dashboard" element={<StoreDashboard />} />
            <Route path="/store/inward" element={<StorePurchaseInward />} />
            <Route path="/store/requests" element={<StoreStockRequests />} />
            <Route path="/store/inventory" element={<StoreInventoryReport />} />
            <Route path="/store/lp-requests" element={<StoreLPRequests />} />

            {/* Admin */}
            <Route path="/admin/approvals" element={<AdminApprovals />} />
            <Route path="/admin/purchase-approvals" element={<AdminPurchaseApprovals />} />
            <Route path="/admin/revoke-approvals" element={<AdminRevokeApprovals />} />
            <Route path="/admin/lp-approvals" element={<AdminLPApprovals />} />
            <Route path="/admin/attendance" element={<AdminAttendance />} />
            <Route path="/admin/inventory" element={<AdminInventory />} />
            <Route path="/admin/pl-report" element={<AdminPLReport />} />
            <Route path="/admin/skus" element={<AdminSkuRegistry />} />
            <Route path="/admin/users" element={<AdminUserRegistry />} />
          </Route>
        </Route>

        <Route path="/" element={<RoleRedirect />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}
