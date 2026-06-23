import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import ChangePasswordModal from "../common/ChangePasswordModal";

export default function AppShell() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-20 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        isMobileOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        onChangePassword={() => setShowChangePw(true)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar onMenuClick={() => setIsMobileOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-7">
          <Outlet />
        </main>
      </div>

      <ChangePasswordModal open={showChangePw} onClose={() => setShowChangePw(false)} />
    </div>
  );
}
