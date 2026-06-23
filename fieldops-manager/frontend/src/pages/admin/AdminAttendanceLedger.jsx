import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import Button from "../../components/common/Button";
import { PageSpinner } from "../../components/common/Spinner";
import { formatDate, buildCsvBlob, triggerDownload, todayStr } from "../../utils/formatters";

const ATTENDANCE_COLOR = {
  Present: "text-green-600",
  Absent: "text-red-600",
  Half_Day: "text-yellow-600",
  Leave: "text-blue-600",
};

export default function AdminAttendanceLedger({ embedded = false }) {
  const today = todayStr();
  const [filters, setFilters] = useState({ from: "", to: "", status: "" });

  const activeParams = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));

  const { data, isLoading } = useQuery({
    queryKey: ["attendance-ledger", activeParams],
    queryFn: () =>
      api.get("/attendance-ledger", { params: activeParams }).then((r) => r.data.data),
  });

  const records = data || [];

  const handleDownload = () => {
    if (records.length === 0) { toast.warn("No data to export"); return; }
    const headers = [
      "Date",
      "User Name",
      "Role",
      "Attendance Status",
      "Remarks",
      "Approved By",
      "Approved At",
    ];
    const rows = records.map((r) => [
      new Date(r.date).toISOString().split("T")[0],
      r.userName,
      r.role,
      r.attendanceStatus,
      r.remarks || "",
      r.approvedByName,
      new Date(r.approvedAt).toLocaleString("en-IN"),
    ]);
    triggerDownload(buildCsvBlob(headers, rows), `attendance_ledger_${today}.csv`);
    toast.success("Ledger exported!");
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        {!embedded && (
          <div>
            <h1 className="text-xl font-bold">Attendance Ledger</h1>
            <p className="text-sm text-muted mt-0.5">Approved attendance records for TL and SM</p>
          </div>
        )}
        <Button size="sm" onClick={handleDownload} disabled={records.length === 0}>
          <i className="ti ti-download" /> Download CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="label">From Date</label>
            <input
              type="date"
              className="input"
              value={filters.from}
              max={today}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">To Date</label>
            <input
              type="date"
              className="input"
              value={filters.to}
              max={today}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Attendance Status</label>
            <select
              className="input"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Half_Day">Half Day</option>
              <option value="Leave">Leave</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button
              variant="default"
              fullWidth
              onClick={() => setFilters({ from: "", to: "", status: "" })}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <PageSpinner />
      ) : (
        <Card>
          <CardTitle right={`${records.length} record${records.length !== 1 ? "s" : ""}`}>
            Approved Attendance
          </CardTitle>
          <div className="overflow-x-auto tbl">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Approved By</th>
                  <th>Approved At</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-6">
                      No approved attendance records found
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDate(r.date)}</td>
                      <td className="font-medium">{r.userName}</td>
                      <td className="text-sm text-muted">{r.role?.replace(/_/g, " ")}</td>
                      <td>
                        <span className={`text-sm font-semibold ${ATTENDANCE_COLOR[r.attendanceStatus] || ""}`}>
                          {r.attendanceStatus}
                        </span>
                      </td>
                      <td className="text-sm text-muted max-w-[220px] truncate">
                        {r.remarks || "—"}
                      </td>
                      <td className="text-sm">{r.approvedByName}</td>
                      <td className="text-xs text-muted">{formatDate(r.approvedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
