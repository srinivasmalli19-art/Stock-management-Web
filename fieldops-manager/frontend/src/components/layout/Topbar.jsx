import { useLocation } from "react-router-dom";
import NotificationBell from "../common/NotificationBell";

const PAGE_TITLES = {
  "/superadmin/dashboard": "Global Overview",
  "/superadmin/organisations": "Organisation Management",
  "/superadmin/users": "All Users",
  "/admin/dashboard": "Admin Dashboard",
  "/admin/approvals": "Productivity Approval Queue",
  "/admin/purchase-approvals": "Purchase Inward Approvals",
  "/admin/revoke-approvals": "Stock Revoke Approvals",
  "/admin/attendance": "Attendance Register",
  "/admin/inventory": "Store Inventory",
  "/admin/pl-report": "Monthly P&L Report",
  "/admin/skus": "SKU Registry",
  "/admin/users": "User Registry",
  "/store/dashboard": "Store Dashboard",
  "/store/inward": "Purchase Inward",
  "/store/requests": "Stock Requests",
  "/store/inventory": "Inventory Report",
  "/tl/dashboard": "Team Dashboard",
  "/tl/approvals": "Validation Queue",
  "/tl/lp-requests": "LP Requests",
  "/tl/attendance": "My Attendance",
  "/store/lp-requests": "Claim Validation Queue",
  "/store/attendance": "My Attendance",
  "/admin/attendance-approval": "Attendance Approval",
  "/admin/attendance-ledger": "Attendance Ledger",
  "/admin/lp-approvals": "LP & Claim Approvals",
  "/admin/audit-logs": "Audit Logs",
  "/superadmin/audit-logs": "Global Audit Logs",
  "/superadmin/monitoring": "Platform Monitoring",
  "/engineer/dashboard": "My Dashboard",
  "/engineer/productivity": "Log Productivity",
  "/engineer/status": "Approval Status",
  "/engineer/stock": "My Van Stock",
  "/notifications": "Notifications",
};

export default function Topbar({ onMenuClick }) {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || "LogiTask";
  const now = new Date();

  const dateStr = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });

  return (
    <header className="bg-white border-b border-border px-4 md:px-6 h-14 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
          aria-label="Open menu"
        >
          <i className="ti ti-menu-2 text-xl" />
        </button>
        <h1 className="text-[15px] font-semibold text-text truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <NotificationBell />
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 border border-border text-xs font-medium text-muted">
          <i className="ti ti-calendar text-[13px]" />
          {dateStr}
        </div>
      </div>
    </header>
  );
}
