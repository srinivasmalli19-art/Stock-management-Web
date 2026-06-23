import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import Button from "../../components/common/Button";
import { PageSpinner } from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import { formatCurrency, getCurrentMonthPrefix, formatMonth, getMonthRange, triggerDownload } from "../../utils/formatters";

const ROLE_LABELS = { Engineer: "Engineer", Team_Leader: "Team Leader", Store_Manager: "Store Manager" };
const ROLE_COLORS = { Engineer: "text-accent", Team_Leader: "text-green-700", Store_Manager: "text-amber-700" };

const stepMonth = (prefix, delta) => {
  const current = getCurrentMonthPrefix();
  const [y, m] = prefix.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return next > current ? current : next;
};

export default function AdminAttendance() {
  const [prefix, setPrefix] = useState(getCurrentMonthPrefix);
  const { daysInMonth } = getMonthRange(prefix);
  const currentPrefix = getCurrentMonthPrefix();

  const { data: summaryRes, isLoading: sl } = useQuery({
    queryKey: ["attendance-summary", prefix],
    queryFn: () => api.get("/attendance/summary", { params: { month: prefix } }).then((r) => r.data.data),
  });

  const { data: allRes, isLoading: gl } = useQuery({
    queryKey: ["attendance-all", prefix],
    queryFn: () => api.get("/attendance/all", { params: { month: prefix } }).then((r) => r.data.data),
  });

  const handleDownload = async () => {
    try {
      const res = await api.get("/attendance/csv", { params: { month: prefix }, responseType: "blob" });
      triggerDownload(res.data, `attendance-report-${prefix}.csv`);
      toast.success("Attendance report downloaded!");
    } catch { toast.error("Download failed"); }
  };

  if (sl || gl) return <PageSpinner />;

  const summary = summaryRes || [];
  const allData = allRes || {};

  const today = new Date().toISOString().split("T")[0];
  const days = Array.from({ length: daysInMonth }, (_, i) =>
    `${prefix}-${String(i + 1).padStart(2, "0")}`
  );

  // Build unified grid: userId → date → status string
  const userGrid = {};

  // Engineers from Attendance table
  (allData.engineers || []).forEach((a) => {
    const uid = a.engineerId || a.engineer?.id;
    if (!uid) return;
    const key = new Date(a.date).toISOString().split("T")[0];
    if (!userGrid[uid]) userGrid[uid] = {};
    userGrid[uid][key] = a.status === "Present" ? "P" : "A";
  });

  // TL/SM from StaffAttendance table
  (allData.staff || []).forEach((a) => {
    const uid = a.userId || a.user?.id;
    if (!uid) return;
    const key = new Date(a.date).toISOString().split("T")[0];
    if (!userGrid[uid]) userGrid[uid] = {};
    // Show attendance status; pending = different color handled by submissionStatus
    if (a.submissionStatus === "Approved") {
      userGrid[uid][key] = a.attendanceStatus === "Present" ? "P" : a.attendanceStatus === "Half_Day" ? "H" : "A";
    } else if (a.submissionStatus === "Pending") {
      userGrid[uid][key] = "?"; // pending approval
    }
  });

  const totalPresent = summary.reduce((s, e) => s + (e.daysPresent || 0), 0);
  const totalAbsent = summary.reduce((s, e) => s + (e.daysAbsent || 0), 0);
  const overallPct = (totalPresent + totalAbsent) > 0
    ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100)
    : 0;

  // Group summary by role for cleaner display
  const byRole = {
    Engineer: summary.filter((r) => r.role === "Engineer"),
    Team_Leader: summary.filter((r) => r.role === "Team_Leader"),
    Store_Manager: summary.filter((r) => r.role === "Store_Manager"),
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-4xl font-bold text-text">Consolidated Attendance Register</h1>
          {summary.length > 0 && (
            <p className="text-sm text-muted mt-0.5">
              {formatMonth(prefix)} · Overall {overallPct}% attendance
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" onClick={() => setPrefix(stepMonth(prefix, -1))}>
            <i className="ti ti-chevron-left" />
          </Button>
          <span className="text-sm font-semibold min-w-[120px] text-center">{formatMonth(prefix)}</span>
          <Button size="sm" variant="default" onClick={() => setPrefix(stepMonth(prefix, 1))} disabled={prefix === currentPrefix}>
            <i className="ti ti-chevron-right" />
          </Button>
          <Button size="sm" onClick={handleDownload}>
            <i className="ti ti-download" /> CSV
          </Button>
        </div>
      </div>

      {/* Month-wise Summary Table */}
      <Card className="mb-4">
        <CardTitle>Month-wise Summary — {formatMonth(prefix)}</CardTitle>
        {summary.length === 0 ? (
          <EmptyState icon="ti-calendar-off" message="No attendance data for this month" />
        ) : (
          <div className="overflow-x-auto tbl">
            <table>
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Role</th>
                  <th>Days Present</th>
                  <th>Days Absent</th>
                  <th>Att %</th>
                </tr>
              </thead>
              <tbody>
                {["Engineer", "Team_Leader", "Store_Manager"].map((role) =>
                  byRole[role].length > 0 ? [
                    <tr key={`section-${role}`} className="bg-bg">
                      <td colSpan={5} className="py-1.5">
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${ROLE_COLORS[role]}`}>
                          {ROLE_LABELS[role]}s
                        </span>
                      </td>
                    </tr>,
                    ...byRole[role].map((row) => {
                      const total = (row.daysPresent || 0) + (row.daysAbsent || 0);
                      const pct = total > 0 ? Math.round(((row.daysPresent || 0) / total) * 100) : 0;
                      const pctColor = pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--warn)" : "var(--danger)";
                      return (
                        <tr key={row.userId}>
                          <td><strong>{row.name}</strong></td>
                          <td><span className={`text-xs font-semibold ${ROLE_COLORS[role]}`}>{ROLE_LABELS[role]}</span></td>
                          <td>{row.daysPresent}</td>
                          <td>{row.daysAbsent}</td>
                          <td>
                            <span className="font-semibold text-xs" style={{ color: pctColor }}>{pct}%</span>
                          </td>
                        </tr>
                      );
                    }),
                  ] : []
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Daily Attendance Grid — all roles */}
      <Card className="overflow-x-auto">
        <CardTitle>Daily Attendance Grid — {formatMonth(prefix)}</CardTitle>
        <div className="flex items-center gap-4 mb-3 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="text-success font-bold">P</span> Present</span>
          <span className="flex items-center gap-1"><span className="text-danger font-bold">A</span> Absent</span>
          <span className="flex items-center gap-1"><span className="text-amber-500 font-bold">H</span> Half Day</span>
          <span className="flex items-center gap-1"><span className="text-muted font-bold">?</span> Pending approval</span>
        </div>
        {summary.length === 0 ? (
          <EmptyState icon="ti-calendar-off" message="No data for this month" />
        ) : (
          <div className="overflow-x-auto tbl">
            <table style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th className="text-xs text-muted">Role</th>
                  {days.map((d) => (
                    <th key={d} style={{ textAlign: "center", minWidth: 28, fontSize: 10, padding: "4px" }}>
                      {d.split("-")[2]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["Engineer", "Team_Leader", "Store_Manager"].map((role) =>
                  byRole[role].map((emp) => (
                    <tr key={emp.userId}>
                      <td className="whitespace-nowrap"><strong>{emp.name}</strong></td>
                      <td className={`text-xs font-semibold ${ROLE_COLORS[role]}`}>{ROLE_LABELS[role]}</td>
                      {days.map((d) => {
                        const val = userGrid[emp.userId]?.[d];
                        const isPast = new Date(d) <= new Date(today);
                        return (
                          <td key={d} style={{ textAlign: "center", padding: 4 }}>
                            {val === "P"
                              ? <span className="text-success text-sm font-bold">P</span>
                              : val === "H"
                              ? <span className="text-amber-500 text-xs font-bold">H</span>
                              : val === "?"
                              ? <span className="text-muted text-xs">?</span>
                              : val === "A"
                              ? <span className="text-danger text-xs font-bold">A</span>
                              : isPast
                              ? <span className="text-border2 text-xs">—</span>
                              : <span className="text-border2">·</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
