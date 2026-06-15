import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import Card, { CardTitle } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import { PageSpinner } from "../../components/common/Spinner";
import Button from "../../components/common/Button";
import { formatDate, formatCurrency, getCurrentMonthPrefix, getMonthRange, formatMonth } from "../../utils/formatters";

const STATUSES = ["Pending", "Validated", "Approved", "Rejected"];
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const clampPrefix = (prefix) => {
  const current = getCurrentMonthPrefix();
  const [cy, cm] = current.split("-").map(Number);
  const [py, pm] = prefix.split("-").map(Number);
  // Don't go into the future
  if (py > cy || (py === cy && pm > cm)) return current;
  // Don't go more than 12 months back
  const diff = (cy - py) * 12 + (cm - pm);
  if (diff > 12) {
    const d = new Date(cy, cm - 13, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return prefix;
};

const stepMonth = (prefix, delta) => {
  const [y, m] = prefix.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return clampPrefix(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
};

export default function EngApprovalStatus() {
  const { currentUser } = useAuth();
  const [prefix, setPrefix] = useState(getCurrentMonthPrefix);

  const { daysInMonth } = getMonthRange(prefix);
  const [year, mo] = prefix.split("-");

  const { data: logsRes, isLoading: logsLoading } = useQuery({
    queryKey: ["productivity", "mine"],
    queryFn: () => api.get("/productivity").then((r) => r.data.data),
  });

  const { data: attRes, isLoading: attLoading } = useQuery({
    queryKey: ["attendance", prefix, currentUser?.id],
    queryFn: () =>
      api.get("/attendance", { params: { month: prefix, engineerId: currentUser?.id } })
        .then((r) => r.data.data),
  });

  if (logsLoading || attLoading) return <PageSpinner />;

  const logs = logsRes || [];
  const att = attRes || [];
  const attMap = {};
  att.forEach((a) => {
    const key = new Date(a.date).toISOString().split("T")[0];
    attMap[key] = a.status;
  });

  const today = new Date().toISOString().split("T")[0];
  const firstDow = new Date(`${prefix}-01`).getDay();

  const calCells = [];
  for (let i = 0; i < firstDow; i++) calCells.push({ empty: true });
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${prefix}-${String(d).padStart(2, "0")}`;
    const isToday = ds === today;
    const status = attMap[ds];
    const past = new Date(ds) < new Date(today);
    calCells.push({ d, ds, isToday, status, past });
  }

  const presentDays = att.filter((a) => a.status === "Present").length;
  const pastDays = calCells.filter((c) => !c.empty && c.past).length;
  const pct = pastDays > 0 ? Math.round((presentDays / pastDays) * 100) : 0;
  const currentPrefix = getCurrentMonthPrefix();

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Productivity & Attendance Status</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Calendar */}
        <Card>
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPrefix(stepMonth(prefix, -1))}
            >
              <i className="ti ti-chevron-left text-sm" />
            </Button>
            <div className="text-center">
              <div className="text-sm font-semibold">{formatMonth(prefix)}</div>
              <div className="text-xs text-muted mt-0.5">
                <span className="text-success font-medium">{presentDays} present</span>
                {" · "}
                <span className="text-danger">{pastDays - presentDays} absent</span>
                {pastDays > 0 && (
                  <span className="ml-2 font-bold" style={{ color: pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--warn)" : "var(--danger)" }}>
                    {pct}%
                  </span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPrefix(stepMonth(prefix, 1))}
              disabled={prefix === currentPrefix}
            >
              <i className="ti ti-chevron-right text-sm" />
            </Button>
          </div>

          {/* Progress bar */}
          {pastDays > 0 && (
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--warn)" : "var(--danger)",
                }}
              />
            </div>
          )}

          <div className="cal-header">
            {DAY_NAMES.map((d) => (
              <span key={d} className="text-center text-[10px] font-semibold text-muted uppercase">{d}</span>
            ))}
          </div>
          <div className="cal-grid">
            {calCells.map((cell, i) => {
              if (cell.empty) return <div key={i} />;
              let cls = "cal-day text-sm font-medium ";
              if (cell.isToday) cls += "border-2 border-accent ";
              if (cell.status === "Present") cls += "bg-green-100 text-green-800 ";
              else if (cell.past && !cell.status) cls += "bg-red-50 text-red-700 ";
              else cls += "text-muted ";
              return <div key={i} className={cls}>{cell.d}</div>;
            })}
          </div>
          <div className="flex gap-3 mt-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" />Present</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-50 border border-red-300" />Absent</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border-2 border-accent" />Today</span>
          </div>
        </Card>

        {/* Status Summary */}
        <Card>
          <CardTitle>Entry Status Summary</CardTitle>
          {STATUSES.map((s) => (
            <div key={s} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
              <Badge status={s} />
              <strong>{logs.filter((l) => l.status === s).length} entries</strong>
            </div>
          ))}
        </Card>
      </div>

      {/* All Logs Table */}
      <Card>
        <CardTitle>All Productivity Logs</CardTitle>
        <div className="overflow-x-auto tbl">
          <table>
            <thead>
              <tr><th>Date</th><th>Calls</th><th>Revenue</th><th>Status</th><th>TL Note</th></tr>
            </thead>
            <tbody>
              {[...logs].sort((a, b) => new Date(b.date) - new Date(a.date)).map((log) => (
                <tr key={log.id}>
                  <td>{formatDate(log.date)}</td>
                  <td>{log.callsClosed}</td>
                  <td>{formatCurrency((log.items || []).reduce((s, i) => s + i.saleValue, 0))}</td>
                  <td><Badge status={log.status} /></td>
                  <td className="text-xs text-muted">{log.tlNote || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
