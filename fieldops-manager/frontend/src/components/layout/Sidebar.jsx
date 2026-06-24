import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { NAV_ITEMS } from "../../constants/navItems";
import { ROLE_LABELS } from "../../constants/roles";

export default function Sidebar({ isMobileOpen, onClose }) {
  const { currentUser } = useAuth();
  const items = NAV_ITEMS[currentUser?.role] || [];
  const initials = currentUser?.name?.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "U";

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-30 w-[270px] bg-sidebar flex flex-col h-screen
        border-r border-sidebar-border shadow-sidebar overflow-hidden
        transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        md:relative md:translate-x-0 md:z-auto md:shrink-0 md:shadow-none
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}
    >
      {/* ── Brand header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center shrink-0 shadow-md">
            <i className="ti ti-tool text-white text-[20px]" />
          </div>
          <div>
            <span className="text-[17px] font-bold text-text tracking-tight block leading-tight">LogiTask</span>
            <span className="text-[10px] text-muted font-semibold tracking-wide uppercase">Field Operations</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-gray-100 transition-colors cursor-pointer"
          aria-label="Close menu"
        >
          <i className="ti ti-x text-lg" />
        </button>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────────── */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {items.map((item, idx) => {
          if (item.section) {
            return (
              <div
                key={`section-${idx}`}
                className="px-3 pt-5 pb-1.5 text-[10px] font-extrabold text-muted/50 uppercase tracking-[0.12em] first:pt-2"
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
                `flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] font-semibold transition-all duration-150 group relative ${
                  isActive
                    ? "bg-accent text-white shadow-sm"
                    : "text-sidebar-text hover:bg-gray-100 hover:text-text"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <i className={`ti ${item.icon} text-[19px] transition-colors shrink-0 ${isActive ? "text-white/90" : "text-muted group-hover:text-accent"}`} />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── User identity ─────────────────────────────────────────────────────── */}
      <div className="px-4 pb-4 border-t border-sidebar-border pt-3.5 shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 rounded-2xl bg-gray-50 border border-border">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-[12px] font-bold shrink-0 shadow-sm">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-bold text-text truncate leading-tight">{currentUser?.name}</div>
            <div className="text-[10px] text-muted font-semibold">{ROLE_LABELS[currentUser?.role] || currentUser?.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
