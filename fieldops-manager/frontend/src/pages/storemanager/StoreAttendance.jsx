import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import Button from "../../components/common/Button";
import AttendanceCalendar from "../../components/common/AttendanceCalendar";
import { PageSpinner } from "../../components/common/Spinner";
import { formatDate, buildCsvBlob, triggerDownload, todayStr, getCurrentMonthPrefix } from "../../utils/formatters";

const STATUS_OPTIONS = [
  { value: "Present", label: "Present" },
  { value: "Absent", label: "Absent" },
  { value: "Half_Day", label: "Half Day" },
  { value: "Leave", label: "Leave" },
];

const ATTENDANCE_BADGE = {
  Present: "bg-green-100 text-green-700",
  Absent: "bg-red-100 text-red-700",
  Half_Day: "bg-yellow-100 text-yellow-700",
  Leave: "bg-blue-100 text-blue-700",
};

const APPROVAL_BADGE = {
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
};

function stepMonth(prefix, delta) {
  const [y, m] = prefix.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function StoreAttendance() {
  const qc = useQueryClient();
  const today = todayStr();
  const currentPrefix = getCurrentMonthPrefix();
  const [prefix, setPrefix] = useState(currentPrefix);
  const [form, setForm] = useState({ date: today, attendanceStatus: "Present", remarks: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["my-staff-attendance"],
    queryFn: () => api.get("/staff-attendance/me").then((r) => r.data.data),
  });

  const submitMut = useMutation({
    mutationFn: (body) => api.post("/staff-attendance", body),
    onSuccess: () => {
      toast.success("Attendance submitted — pending Admin approval");
      qc.invalidateQueries({ queryKey: ["my-staff-attendance"] });
      setForm({ date: today, attendanceStatus: "Present", remarks: "" });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Submission failed"),
  });

  if (isLoading) return <PageSpinner />;

  const records = data || [];
  const calendarRecords = records.filter((r) => {
    const ds = new Date(r.date).toISOString().split("T")[0];
    return ds.startsWith(prefix);
  });

  const todayRecord = records.find(
    (r) => new Date(r.date).toISOString().split("T")[0] === today
  );

  const handlePrev = () => {
    const prev = stepMonth(prefix, -1);
    const [cy, cm] = currentPrefix.split("-").map(Number);
    const [py, pm] = prev.split("-").map(Number);
    if ((cy - py) * 12 + (cm - pm) <= 12) setPrefix(prev);
  };
  const handleNext = () => {
    if (prefix < currentPrefix) setPrefix(stepMonth(prefix, 1));
  };

  const handleDownload = () => {
    if (records.length === 0) { toast.warn("No records to export"); return; }
    const headers = ["Date", "Attendance Status", "Remarks", "Approval Status", "Approved By", "Approved At"];
    const rows = records.map((r) => [
      new Date(r.date).toISOString().split("T")[0],
      r.attendanceStatus,
      r.remarks || "",
      r.submissionStatus,
      r.approvedByName || "",
      r.approvedAt ? formatDate(r.approvedAt) : "",
    ]);
    triggerDownload(buildCsvBlob(headers, rows), `my_attendance_${today}.csv`);
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">My Attendance</h1>
          <p className="text-sm text-muted mt-0.5">Mark attendance — submitted records go to Admin for approval</p>
        </div>
        {records.length > 0 && (
          <Button size="sm" onClick={handleDownload}>
            <i className="ti ti-download" /> Export CSV
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Calendar */}
        <Card>
          <AttendanceCalendar
            records={calendarRecords}
            prefix={prefix}
            onPrevMonth={handlePrev}
            onNextMonth={handleNext}
            isCurrentMonth={prefix === currentPrefix}
          />
        </Card>

        {/* Submit form */}
        <Card>
          <CardTitle>Mark Today's Attendance</CardTitle>
          {todayRecord ? (
            <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg mt-2">
              <span className="text-sm font-medium text-text">Already submitted for today:</span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ATTENDANCE_BADGE[todayRecord.attendanceStatus] || ""}`}>
                {todayRecord.attendanceStatus}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${APPROVAL_BADGE[todayRecord.submissionStatus] || ""}`}>
                {todayRecord.submissionStatus}
              </span>
            </div>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); submitMut.mutate(form); }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2"
            >
              <div>
                <label className="label">Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.date}
                  max={today}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={form.attendanceStatus}
                  onChange={(e) => setForm((f) => ({ ...f, attendanceStatus: e.target.value }))}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Remarks (optional)</label>
                <input
                  className="input"
                  placeholder="e.g. WFH, site visit, medical leave…"
                  value={form.remarks}
                  maxLength={500}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" variant="primary" disabled={submitMut.isPending}>
                  {submitMut.isPending ? "Submitting…" : "Submit Attendance"}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>

      {/* History table */}
      <Card>
        <CardTitle right={`${records.length} records`}>Submission History</CardTitle>
        <div className="overflow-x-auto tbl">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th className="hidden sm:table-cell">Remarks</th>
                <th>Approval</th>
                <th className="hidden sm:table-cell">Approved By</th>
                <th className="hidden sm:table-cell">Approved At</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-6">
                    No attendance submitted yet
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.date)}</td>
                    <td>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ATTENDANCE_BADGE[r.attendanceStatus] || ""}`}>
                        {r.attendanceStatus}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell text-sm text-muted">{r.remarks || "—"}</td>
                    <td>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${APPROVAL_BADGE[r.submissionStatus] || ""}`}>
                        {r.submissionStatus}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell text-sm">{r.approvedByName || "—"}</td>
                    <td className="hidden sm:table-cell text-xs text-muted">{r.approvedAt ? formatDate(r.approvedAt) : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
