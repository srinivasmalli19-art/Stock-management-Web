import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Tabs from "../../components/common/Tabs";
import AdminApprovals from "./AdminApprovals";
import AdminAttendanceApproval from "./AdminAttendanceApproval";
import api from "../../services/api";

export default function AdminApprovalCenter() {
  const [tab, setTab] = useState("productivity");

  const { data: widgets } = useQuery({
    queryKey: ["dashboard-widgets", "admin"],
    queryFn: () => api.get("/dashboard/widgets").then((r) => r.data.data),
    staleTime: 30000,
  });

  const pending = widgets?.pending || {};
  const pendingProductivity = pending.productivity || 0;
  const pendingAttendance = pending.attendance || 0;
  const totalPending = pendingProductivity + pendingAttendance;

  const TABS = [
    {
      key: "productivity",
      label: pendingProductivity > 0
        ? `Productivity Approvals (${pendingProductivity})`
        : "Productivity Approvals",
    },
    {
      key: "attendance",
      label: pendingAttendance > 0
        ? `Attendance Approvals (${pendingAttendance})`
        : "Attendance Approvals",
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-5xl font-extrabold text-text tracking-tight">Approval Center</h1>
          <p className="text-sm text-muted mt-1">
            Review and action productivity logs and staff attendance submissions
          </p>
        </div>
        {totalPending > 0 && (
          <div className="shrink-0 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold px-4 py-2 rounded-2xl">
            <i className="ti ti-clock text-[16px]" />
            {totalPending} pending
          </div>
        )}
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === "productivity" && <AdminApprovals />}
      {tab === "attendance" && <AdminAttendanceApproval />}
    </div>
  );
}
