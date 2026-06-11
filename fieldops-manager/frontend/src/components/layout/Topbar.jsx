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
  "/engineer/dashboard": "My Dashboard",
  "/engineer/productivity": "Log Productivity",
  "/engineer/status": "Approval Status",
  "/engineer/stock": "My Van Stock",
};

export default function Topbar() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || "FieldOps";
  const dateStr = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="bg-white border-b border-border px-6 h-14 flex items-center justify-between flex-shrink-0">
      <h1 className="text-base font-semibold text-text">{title}</h1>
      <span className="text-xs text-muted">{dateStr}</span>
    </header>
  );
}
