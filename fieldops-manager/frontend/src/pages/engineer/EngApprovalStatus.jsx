import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import Card, { CardTitle } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import { PageSpinner } from "../../components/common/Spinner";
import { formatDate, formatCurrency, getCurrentMonthPrefix, getMonthRange } from "../../utils/formatters";

const STATUSES = ["Pending", "Validated", "Approved", "Rejected"];
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function EngApprovalStatus() {
  const { currentUser } = useAuth();
  const prefix = getCurrentMonthPrefix();
  const { daysInMonth } = getMonthRange(prefix);
  const [year, mo] = prefix.split("-");

  const { data: logsRes, isLoading: logsLoading } = useQuery({
    queryKey: ["productivity", "mine"],
    queryFn: () => api.get("/productivity").then((r) => r.data.data),
  });

  const { data: attRes, isLoading: attLoading } = useQuery({
    queryKey: ["attendance", prefix],
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
    calCells.push({ d, ds, isToday, status, past: new Date(ds) < new Date() });
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Productivity & Attendance Status</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Calendar */}
        <Card>
          <CardTitle>Attendance Calendar</CardTitle>
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
              if (cell.status === "Present") cls += "bg-green-50 text-green-800 ";
              else if (cell.past && !cell.status) cls += "bg-red-50 text-red-700 ";
              else cls += "text-muted ";
              return <div key={i} className={cls}>{cell.d}</div>;
            })}
          </div>
          <div className="flex gap-3 mt-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-50 border border-green-300" />Present</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-50 border border-red-300" />Absent</span>
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
