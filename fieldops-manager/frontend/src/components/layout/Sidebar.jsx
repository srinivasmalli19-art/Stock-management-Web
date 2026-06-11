import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { NAV_ITEMS } from "../../constants/navItems";
import { ROLE_LABELS } from "../../constants/roles";

export default function Sidebar() {
  const { currentUser, logout } = useAuth();
  const items = NAV_ITEMS[currentUser?.role] || [];

  return (
    <aside className="w-[220px] min-w-[220px] bg-sidebar flex flex-col h-screen overflow-y-auto">
      <div className="px-4 pt-5 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-white font-bold text-base">
          <i className="ti ti-bolt text-sidebar-active text-xl" />
          FieldOps
        </div>
        <div className="text-sidebar-text text-xs mt-2">{currentUser?.name}</div>
        <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 uppercase tracking-wide">
          {ROLE_LABELS[currentUser?.role] || currentUser?.role}
        </span>
      </div>

      <nav className="flex-1 py-3">
        {items.map((item, idx) => {
          if (item.section) {
            return (
              <div key={idx} className="px-4 pt-3 pb-1 text-[10px] font-semibold text-sidebar-text/50 uppercase tracking-widest">
                {item.section}
              </div>
            );
          }
          return (
            <NavLink
              key={item.page}
              to={item.page}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2.5 text-[13px] transition-all duration-150 border-l-[3px] ${
                  isActive
                    ? "bg-blue-500/15 text-blue-300 border-sidebar-active"
                    : "text-sidebar-text hover:bg-white/5 hover:text-slate-200 border-transparent"
                }`
              }
            >
              <i className={`ti ${item.icon} text-[17px]`} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-white/10">
        <button
          onClick={logout}
          className="flex items-center gap-2.5 text-sidebar-text hover:text-white text-[13px] transition-colors w-full cursor-pointer"
        >
          <i className="ti ti-logout text-[17px]" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
