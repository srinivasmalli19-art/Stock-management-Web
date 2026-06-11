import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import MetricCard from "../../components/common/MetricCard";
import Card, { CardTitle } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import { PageSpinner } from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import { formatDate, formatCurrency, getCurrentMonthPrefix, formatMonth } from "../../utils/formatters";

export default function EngDashboard() {
  const { currentUser } = useAuth();
  const prefix = getCurrentMonthPrefix();

  const { data, isLoading } = useQuery({
    queryKey: ["eng-dashboard"],
    queryFn: () => api.get("/dashboard/engineer").then((r) => r.data.data),
  });

  if (isLoading) return <PageSpinner />;

  const { callsClosed = 0, revenue = 0, incentive = 0, daysPresent = 0, logs = [] } = data || {};
  const firstName = currentUser?.name?.split(" ")[0] || "there";

  return (
    <div>
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-text">Welcome, {firstName} 👋</h1>
          <p className="text-sm text-muted mt-0.5">Month-to-date · {formatMonth(prefix)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Calls Closed (MTD)" value={callsClosed} color="accent" />
        <MetricCard label="Revenue (MTD)" value={formatCurrency(revenue)} color="green" />
        <MetricCard label="Days Present" value={daysPresent} color="amber" />
        <MetricCard label="Incentive Earned" value={formatCurrency(incentive)} color="red" />
      </div>

      <Card>
        <CardTitle right={`${logs.length} entries`}>Monthly Progress — {formatMonth(prefix)}</CardTitle>
        {logs.length === 0 ? (
          <EmptyState icon="ti-clipboard-off" message="No entries this month" />
        ) : (
          <div className="overflow-x-auto tbl">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Calls</th><th>Accessories</th><th>Revenue</th><th>Incentive</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...logs].sort((a, b) => new Date(b.date) - new Date(a.date)).map((log) => {
                  const lrev = (log.items || []).reduce((s, i) => s + i.saleValue, 0);
                  const linc = log.status === "Approved"
                    ? (log.items || []).reduce((s, i) => s + (i.adminIncentive || 0), 0)
                    : null;
                  const accessories = (log.items || [])
                    .map((i) => `${i.sku?.name || i.skuId} ×${i.qty}`)
                    .join(", ") || "—";
                  return (
                    <tr key={log.id}>
                      <td>{formatDate(log.date)}</td>
                      <td><strong>{log.callsClosed}</strong></td>
                      <td className="text-xs text-muted">{accessories}</td>
                      <td>{formatCurrency(lrev)}</td>
                      <td>{linc !== null ? formatCurrency(linc) : <span className="text-muted">—</span>}</td>
                      <td><Badge status={log.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
