import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import MetricCard from "../../components/common/MetricCard";
import Card, { CardTitle } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import { PageSpinner } from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import { formatDate, formatCurrency, getCurrentMonthPrefix, formatMonth } from "../../utils/formatters";

const INR = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;
const SHORT = (v) => `₹${(v / 1000).toFixed(0)}k`;

export default function EngDashboard() {
  const { currentUser } = useAuth();
  const prefix = getCurrentMonthPrefix();

  const { data, isLoading } = useQuery({
    queryKey: ["eng-dashboard"],
    queryFn: () => api.get("/dashboard/engineer").then((r) => r.data.data),
  });

  const { data: stockRes } = useQuery({
    queryKey: ["my-stock"],
    queryFn: () => api.get("/inventory/my-stock").then((r) => r.data.data),
    staleTime: 60000,
  });

  const { data: reqRes } = useQuery({
    queryKey: ["stock-requests", "mine"],
    queryFn: () => api.get("/stock-requests").then((r) => r.data.data),
    staleTime: 60000,
  });

  if (isLoading) return <PageSpinner />;

  const { callsClosed = 0, revenue = 0, incentive = 0, daysPresent = 0, logs = [] } = data || {};
  const stock = stockRes || [];
  const requests = reqRes || [];
  const pendingReqs = requests.filter((r) => r.status === "Pending").length;
  const stockItems = stock.length;
  const firstName = currentUser?.name?.split(" ")[0] || "there";

  // Build per-day chart data from logs
  const chartData = [...logs]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((log) => ({
      day: log.date?.slice(8, 10), // DD
      Calls: log.callsClosed,
      Revenue: Math.round((log.items || []).reduce((s, i) => s + i.saleValue, 0)),
    }));

  return (
    <div>
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-text">Welcome, {firstName}</h1>
          <p className="text-sm text-muted mt-0.5">Month-to-date · {formatMonth(prefix)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <MetricCard label="Calls Closed (MTD)" value={callsClosed} color="accent" />
        <MetricCard label="Revenue (MTD)" value={formatCurrency(revenue)} color="green" />
        <MetricCard label="Days Present" value={daysPresent} color="amber" />
        <MetricCard label="Incentive Earned" value={formatCurrency(incentive)} color="red" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <MetricCard label="Van Stock Items" value={stockItems} sub="SKUs currently allocated" color="accent" />
        <MetricCard label="Pending Stock Requests" value={pendingReqs} sub={pendingReqs > 0 ? "awaiting store approval" : "all fulfilled"} color={pendingReqs > 0 ? "amber" : "green"} />
      </div>

      {chartData.length > 1 && (
        <Card className="mb-5">
          <CardTitle>Daily Activity — {formatMonth(prefix)}</CardTitle>
          <div className="mt-3" style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 12, left: 4, bottom: 4 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: "Day", position: "insideBottomRight", offset: -4, fontSize: 10, fill: "#9ca3af" }}
                />
                <YAxis
                  yAxisId="calls"
                  orientation="left"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="money"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  tickFormatter={SHORT}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  formatter={(v, name) => (name === "Calls" ? [v, name] : [INR(v), name])}
                  labelFormatter={(l) => `Day ${l}`}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Bar yAxisId="calls" dataKey="Calls" fill="#3b5bdb" radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar yAxisId="money" dataKey="Revenue" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

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
