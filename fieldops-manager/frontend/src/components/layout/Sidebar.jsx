import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { NAV_ITEMS } from "../../constants/navItems";
import { ROLE_LABELS } from "../../constants/roles";

export default function Sidebar({ isMobileOpen, onClose, onChangePassword }) {
  const { currentUser, logout } = useAuth();
  const items = NAV_ITEMS[currentUser?.role] || [];
  const initials = currentUser?.name?.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "U";

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-30 w-[248px] bg-sidebar flex flex-col h-screen
        border-r border-sidebar-border shadow-sidebar overflow-hidden
        transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        md:relative md:translate-x-0 md:z-auto md:shrink-0 md:shadow-none
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}
    >
      {/* ── Brand header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <i className="ti ti-tool text-white text-[18px]" />
          </div>
          <span className="text-[17px] font-bold text-text tracking-tight">LogiTask</span>
        </div>
        <button
          onClick={onClose}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-gray-100 transition-colors cursor-pointer"
          aria-label="Close menu"
        >
          <i className="ti ti-x text-lg" />
        </button>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────────── */}
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {items.map((item, idx) => {
          if (item.section) {
            return (
              <div
                key={`section-${idx}`}
                className="px-3 pt-5 pb-1.5 text-[10px] font-bold text-muted/60 uppercase tracking-[0.1em] first:pt-2"
              >
                {item.section}
              </div>
            );
          }
          return (
            <NavLink
              key={item.page}
              to={item.page}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 group ${
                  isActive
                    ? "bg-accent2 text-accent font-semibold"
                    : "text-sidebar-text hover:bg-gray-100 hover:text-text"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <i className={`ti ${item.icon} text-[18px] transition-colors ${isActive ? "text-accent" : "text-muted group-hover:text-text"}`} />
                  {item.label}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Bottom actions ────────────────────────────────────────────────────── */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3 shrink-0">
        <button
          onClick={() => { onClose(); onChangePassword(); }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-sidebar-text hover:bg-gray-100 hover:text-text transition-all duration-150 w-full cursor-pointer"
        >
          <i className="ti ti-lock text-[18px] text-muted" />
          Change Password
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-sidebar-text hover:bg-red-50 hover:text-danger transition-all duration-150 w-full cursor-pointer"
        >
          <i className="ti ti-logout text-[18px] text-muted" />
          Sign Out
        </button>

        {/* User identity */}
        <div className="mt-2 pt-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-[12px] font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-text truncate leading-tight">{currentUser?.name}</div>
              <div className="text-[10px] text-muted">{ROLE_LABELS[currentUser?.role] || currentUser?.role}</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
