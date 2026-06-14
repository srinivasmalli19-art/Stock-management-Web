import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import MetricCard from "../../components/common/MetricCard";
import IncentivePill from "../../components/common/IncentivePill";
import { PageSpinner } from "../../components/common/Spinner";
import { formatCurrency, formatMonth, getCurrentMonthPrefix } from "../../utils/formatters";

const INR = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;
const SHORT = (v) => `₹${(v / 1000).toFixed(0)}k`;

export default function TLDashboard() {
  const prefix = getCurrentMonthPrefix();

  const { data, isLoading } = useQuery({
    queryKey: ["tl-dashboard"],
    queryFn: () => api.get("/dashboard/team-leader").then((r) => r.data.data),
  });

  if (isLoading) return <PageSpinner />;

  const engineers = data || [];

  const totals = engineers.reduce(
    (acc, e) => ({
      calls: acc.calls + (e.callsClosed || 0),
      revenue: acc.revenue + (e.revenue || 0),
      incentive: acc.incentive + (e.incentive || 0),
    }),
    { calls: 0, revenue: 0, incentive: 0 }
  );

  const chartData = engineers.map((e) => ({
    name: e.name.split(" ")[0],
    Calls: e.callsClosed,
    Revenue: Math.round(e.revenue),
    Incentive: Math.round(e.incentive),
  }));

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Team Performance — {formatMonth(prefix)}</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <MetricCard label="Team Calls (MTD)" value={totals.calls} color="accent" />
        <MetricCard label="Team Revenue (MTD)" value={formatCurrency(totals.revenue)} color="green" />
        <MetricCard label="Total Incentive Paid" value={formatCurrency(totals.incentive)} color="amber" />
      </div>

      {chartData.length > 0 && (
        <Card className="mb-5">
          <CardTitle>Team Comparison — {formatMonth(prefix)}</CardTitle>
          <div className="mt-3" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 12, left: 4, bottom: 4 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="calls"
                  orientation="left"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <YAxis
                  yAxisId="money"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  tickFormatter={SHORT}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  formatter={(v, name) => (name === "Calls" ? [v, name] : [INR(v), name])}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                <Bar yAxisId="calls" dataKey="Calls" fill="#3b5bdb" radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar yAxisId="money" dataKey="Revenue" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar yAxisId="money" dataKey="Incentive" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>Engineer-wise Consolidated Report</CardTitle>
        <div className="overflow-x-auto tbl">
          <table>
            <thead>
              <tr>
                <th>Engineer</th>
                <th>Days Present</th>
                <th>Calls Closed</th>
                <th>Revenue</th>
                <th>Incentive Earned</th>
              </tr>
            </thead>
            <tbody>
              {engineers.map((eng) => (
                <tr key={eng.id}>
                  <td>
                    <strong>{eng.name}</strong>
                    <br />
                    <span className="text-xs text-muted">{eng.email}</span>
                  </td>
                  <td>{eng.daysPresent}</td>
                  <td>{eng.callsClosed}</td>
                  <td>{formatCurrency(eng.revenue)}</td>
                  <td><IncentivePill amount={eng.incentive} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
