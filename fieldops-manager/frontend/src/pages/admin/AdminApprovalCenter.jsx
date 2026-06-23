import { useState } from "react";
import Tabs from "../../components/common/Tabs";
import AdminApprovals from "./AdminApprovals";
import AdminAttendanceApproval from "./AdminAttendanceApproval";

const TABS = [
  { key: "productivity", label: "Productivity Approvals" },
  { key: "attendance", label: "Attendance Approvals" },
];

export default function AdminApprovalCenter() {
  const [tab, setTab] = useState("productivity");

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-4xl font-bold text-text">Approval Center</h1>
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === "productivity" && <AdminApprovals />}
      {tab === "attendance" && <AdminAttendanceApproval />}
    </div>
  );
}
