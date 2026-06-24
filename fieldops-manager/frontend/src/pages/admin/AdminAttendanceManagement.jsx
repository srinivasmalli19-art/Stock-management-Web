import { useState } from "react";
import Tabs from "../../components/common/Tabs";
import AdminAttendance from "./AdminAttendance";
import AdminAttendanceLedger from "./AdminAttendanceLedger";

const TABS = [
  { key: "register", label: "Attendance Register" },
  { key: "ledger", label: "Attendance Ledger" },
];

export default function AdminAttendanceManagement() {
  const [tab, setTab] = useState("register");

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-5xl font-extrabold text-text tracking-tight">Attendance Management</h1>
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === "register" && <AdminAttendance embedded />}
      {tab === "ledger" && <AdminAttendanceLedger embedded />}
    </div>
  );
}
