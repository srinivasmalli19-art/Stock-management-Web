import { useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import Button from "../../components/common/Button";
import IncentivePill from "../../components/common/IncentivePill";
import { PageSpinner } from "../../components/common/Spinner";
import { formatCurrency, getCurrentMonthPrefix, formatMonth, getMonthRange, triggerDownload } from "../../utils/formatters";

export default function AdminAttendance() {
  const prefix = getCurrentMonthPrefix();
  const { daysInMonth } = getMonthRange(prefix);
  const [year, mo] = prefix.split("-");

  const { data: summaryRes, isLoading: sl } = useQuery({
    queryKey: ["attendance-summary", prefix],
    queryFn: () => api.get("/attendance/summary", { params: { month: prefix } }).then((r) => r.data.data),
  });

  const { data: gridRes, isLoading: gl } = useQuery({
    queryKey: ["attendance-grid", prefix],
    queryFn: () => api.get("/attendance", { params: { month: prefix } }).then((r) => r.data.data),
  });

  const handleDownload = async () => {
    try {
      const res = await api.get("/attendance/csv", { params: { month: prefix }, responseType: "blob" });
      triggerDownload(res.data, `attendance_${prefix}.csv`);
      toast.success("Attendance report downloaded!");
    } catch { toast.error("Download failed"); }
  };

  if (sl || gl) return <PageSpinner />;

  const summary = summaryRes || [];
  const gridData = gridRes || [];

  const today = new Date().toISOString().split("T")[0];
  const days = Array.from({ length: daysInMonth }, (_, i) =>
    `${prefix}-${String(i + 1).padStart(2, "0")}`
  );

  // Build attendance grid map: engineerId → date → status
  const attGrid = {};
  gridData.forEach((a) => {
    const eId = a.engineerId;
    const key = new Date(a.date).toISOString().split("T")[0];
    if (!attGrid[eId]) attGrid[eId] = {};
    attGrid[eId][key] = a.status;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">Consolidated Attendance Register</h1>
        <Button size="sm" onClick={handleDownload}>
          <i className="ti ti-download" /> Download CSV
        </Button>
      </div>

      <Card className="mb-4">
        <CardTitle>Month-wise Summary — {formatMonth(prefix)}</CardTitle>
        <div className="overflow-x-auto tbl">
          <table>
            <thead>
              <tr><th>Engineer</th><th>Days Present</th><th>Days Absent</th><th>Calls Closed</th><th>Revenue</th><th>Incentive</th></tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.engineerId}>
                  <td><strong>{row.name}</strong></td>
                  <td>{row.daysPresent}</td>
                  <td>{row.daysAbsent}</td>
                  <td>{row.callsClosed}</td>
                  <td>{formatCurrency(row.revenue)}</td>
                  <td><IncentivePill amount={row.incentive} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <CardTitle>Daily Attendance Grid — {formatMonth(prefix)}</CardTitle>
        <div className="overflow-x-auto tbl">
          <table style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th>Engineer</th>
                {days.map((d) => (
                  <th key={d} style={{ textAlign: "center", minWidth: 28, fontSize: 10, padding: "4px" }}>
                    {d.split("-")[2]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.map((eng) => (
                <tr key={eng.engineerId}>
                  <td className="whitespace-nowrap"><strong>{eng.name}</strong></td>
                  {days.map((d) => {
                    const status = attGrid[eng.engineerId]?.[d];
                    const isPast = new Date(d) <= new Date(today);
                    return (
                      <td key={d} style={{ textAlign: "center", padding: 4 }}>
                        {status === "Present"
                          ? <span className="text-success text-sm">✓</span>
                          : isPast && !status
                          ? <span className="text-danger text-xs">—</span>
                          : <span className="text-border2">·</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
