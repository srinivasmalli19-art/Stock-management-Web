import { useLocation } from "react-router-dom";

const PAGE_TITLES = {
  "/admin/approvals": "Productivity Approval Queue",
  "/admin/purchase-approvals": "Purchase Inward Approvals",
  "/admin/revoke-approvals": "Stock Revoke Approvals",
  "/admin/attendance": "Attendance Register",
  "/admin/inventory": "Main Store Inventory",
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
  "/store/lp-requests": "LP Request Queue",
  "/admin/lp-approvals": "LP Claim Approvals",
  "/engineer/dashboard": "My Dashboard",
  "/engineer/productivity": "Log Productivity",
  "/engineer/status": "Approval Status",
  "/engineer/stock": "My Van Stock",
  "/engineer/lp-requests": "My LP Requests",
};

export default function Topbar({ onMenuClick }) {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || "FieldOps";
  const now = new Date();

  const dateStrFull = now.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const dateStrShort = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <header className="bg-white border-b border-border px-4 md:px-6 h-14 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-1.5 rounded text-muted hover:text-text hover:bg-gray-100 transition-colors cursor-pointer"
          aria-label="Open menu"
        >
          <i className="ti ti-menu-2 text-xl" />
        </button>
        <h1 className="text-base font-semibold text-text">{title}</h1>
      </div>
      <span className="text-xs text-muted">
        <span className="hidden md:inline">{dateStrFull}</span>
        <span className="md:hidden">{dateStrShort}</span>
      </span>
    </header>
  );
}
