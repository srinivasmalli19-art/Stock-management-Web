import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "../common/NotificationBell";
import { ROLE_LABELS } from "../../constants/roles";

const PAGE_TITLES = {
  "/superadmin/dashboard": "Global Overview",
  "/superadmin/organisations": "Organisation Management",
  "/superadmin/users": "All Users",
  "/superadmin/audit-logs": "Global Audit Logs",
  "/superadmin/monitoring": "Platform Monitoring",
  "/admin/dashboard": "Admin Dashboard",
  "/admin/approval-center": "Approval Center",
  "/admin/purchase-approvals": "Purchase Inward Approvals",
  "/admin/revoke-approvals": "Stock Revoke Approvals",
  "/admin/attendance-management": "Attendance Management",
  "/admin/inventory": "Store Inventory",
  "/admin/pl-report": "Monthly P&L Report",
  "/admin/skus": "SKU Registry",
  "/admin/users": "User Registry",
  "/admin/audit-logs": "Audit Logs",
  "/admin/lp-approvals": "LP & Claim Approvals",
  "/store/dashboard": "Store Dashboard",
  "/store/inward": "Purchase Inward",
  "/store/requests": "Stock Requests",
  "/store/return-requests": "Return Requests",
  "/store/inventory": "Inventory Report",
  "/store/lp-requests": "Claim Validation Queue",
  "/store/attendance": "My Attendance",
  "/store/skus": "SKU Registry",
  "/tl/dashboard": "Team Dashboard",
  "/tl/approvals": "Validation Queue",
  "/tl/lp-requests": "LP Requests",
  "/tl/attendance": "My Attendance",
  "/engineer/dashboard": "My Dashboard",
  "/engineer/productivity": "Productivity",
  "/engineer/stock": "My Van Stock",
  "/notifications": "Notifications",
};

function ProfileMenu({ onChangePassword }) {
  const { currentUser, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const initials =
    currentUser?.name
      ?.split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white text-[12px] font-bold cursor-pointer hover:bg-indigo-700 transition-colors shrink-0"
        aria-label="Profile menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {/* User info */}
          <div className="px-4 py-3 border-b border-border">
            <div className="text-[13px] font-semibold text-text truncate">{currentUser?.name}</div>
            <div className="text-[11px] text-muted">{ROLE_LABELS[currentUser?.role] || currentUser?.role}</div>
          </div>

          <button
            onClick={() => { setOpen(false); onChangePassword(); }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-[13px] font-medium text-sidebar-text hover:bg-gray-50 hover:text-text transition-colors duration-100 cursor-pointer"
          >
            <i className="ti ti-lock text-[16px] text-muted" />
            Change Password
          </button>
          <button
            onClick={() => { setOpen(false); logout(); }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-[13px] font-medium text-sidebar-text hover:bg-red-50 hover:text-danger transition-colors duration-100 cursor-pointer"
          >
            <i className="ti ti-logout text-[16px] text-muted" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Topbar({ onMenuClick, onChangePassword }) {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || "LogiTask";

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

      <div className="flex items-center gap-2 shrink-0">
        <NotificationBell />
        <ProfileMenu onChangePassword={onChangePassword} />
      </div>
    </header>
  );
}
