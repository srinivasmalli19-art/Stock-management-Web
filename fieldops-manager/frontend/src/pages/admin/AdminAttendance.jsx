import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import Button from "../../components/common/Button";
import IncentivePill from "../../components/common/IncentivePill";
import { PageSpinner } from "../../components/common/Spinner";
import { formatCurrency, getCurrentMonthPrefix, formatMonth, getMonthRange, triggerDownload } from "../../utils/formatters";

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

  const { data: gridRes, isLoading: gl } = useQuery({
    queryKey: ["attendance-grid", prefix],
    queryFn: () => api.get("/attendance", { params: { month: prefix } }).then((r) => r.data.data),
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
  const gridData = gridRes || [];

  const today = new Date().toISOString().split("T")[0];
  const days = Array.from({ length: daysInMonth }, (_, i) =>
    `${prefix}-${String(i + 1).padStart(2, "0")}`
  );

  const attGrid = {};
  gridData.forEach((a) => {
    const eId = a.engineerId;
    const key = new Date(a.date).toISOString().split("T")[0];
    if (!attGrid[eId]) attGrid[eId] = {};
    attGrid[eId][key] = a.status;
  });

  const totalPresent = summary.reduce((s, e) => s + (e.daysPresent || 0), 0);
  const totalAbsent = summary.reduce((s, e) => s + (e.daysAbsent || 0), 0);
  const overallPct = (totalPresent + totalAbsent) > 0
    ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100)
    : 0;

  return (
    <div>
      {/* Header with month nav */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">Consolidated Attendance Register</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" onClick={() => setPrefix(stepMonth(prefix, -1))}>
            <i className="ti ti-chevron-left" />
          </Button>
          <span className="text-sm font-semibold min-w-[120px] text-center">{formatMonth(prefix)}</span>
          <Button
            size="sm"
            variant="default"
            onClick={() => setPrefix(stepMonth(prefix, 1))}
            disabled={prefix === currentPrefix}
          >
            <i className="ti ti-chevron-right" />
          </Button>
          <Button size="sm" onClick={handleDownload}>
            <i className="ti ti-download" /> CSV
          </Button>
        </div>
      </div>

      {/* Per-engineer summary cards */}
      {summary.length > 0 && (
        <div className="mb-5">
          <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
            Attendance Summary — {formatMonth(prefix)}
            <span className="ml-3 font-bold text-text">{overallPct}% overall</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {summary.map((eng) => {
              const total = (eng.daysPresent || 0) + (eng.daysAbsent || 0);
              const pct = total > 0 ? Math.round(((eng.daysPresent || 0) / total) * 100) : 0;
              const barColor = pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--warn)" : "var(--danger)";
              return (
                <div key={eng.engineerId} className="bg-white border border-border rounded-lg p-3 shadow-card">
                  <div className="text-sm font-semibold truncate mb-1">{eng.name}</div>
                  <div className="flex items-center gap-2 text-xs mb-2">
                    <span className="text-success font-medium">{eng.daysPresent || 0}P</span>
                    <span className="text-danger">{eng.daysAbsent || 0}A</span>
                    <span className="ml-auto font-bold" style={{ color: barColor }}>{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Card className="mb-4">
        <CardTitle>Month-wise Summary — {formatMonth(prefix)}</CardTitle>
        <div className="overflow-x-auto tbl">
          <table>
            <thead>
              <tr><th>Engineer</th><th>Days Present</th><th>Days Absent</th><th>Att %</th><th>Calls Closed</th><th>Revenue</th><th>Incentive</th></tr>
            </thead>
            <tbody>
              {summary.map((row) => {
                const total = (row.daysPresent || 0) + (row.daysAbsent || 0);
                const pct = total > 0 ? Math.round(((row.daysPresent || 0) / total) * 100) : 0;
                return (
                  <tr key={row.engineerId}>
                    <td><strong>{row.name}</strong></td>
                    <td>{row.daysPresent}</td>
                    <td>{row.daysAbsent}</td>
                    <td>
                      <span className="font-semibold text-xs" style={{ color: pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--warn)" : "var(--danger)" }}>
                        {pct}%
                      </span>
                    </td>
                    <td>{row.callsClosed}</td>
                    <td>{formatCurrency(row.revenue)}</td>
                    <td><IncentivePill amount={row.incentive} /></td>
                  </tr>
                );
              })}
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
