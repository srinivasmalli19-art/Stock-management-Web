import { useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import Button from "../../components/common/Button";
import MetricCard from "../../components/common/MetricCard";
import IncentivePill from "../../components/common/IncentivePill";
import { PageSpinner } from "../../components/common/Spinner";
import { useMonthSelector } from "../../hooks/useMonthSelector";
import { formatCurrency, triggerDownload } from "../../utils/formatters";

const INR = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;
const SHORT = (v) => `₹${(v / 1000).toFixed(0)}k`;

export default function AdminPLReport() {
  const { selectedMonth, setSelectedMonth, months } = useMonthSelector();

  const { data, isLoading } = useQuery({
    queryKey: ["pl-report", selectedMonth],
    queryFn: () => api.get("/reports/pl", { params: { month: selectedMonth } }).then((r) => r.data.data),
  });

  const handleDownload = async () => {
    try {
      const res = await api.get("/reports/pl/csv", { params: { month: selectedMonth }, responseType: "blob" });
      triggerDownload(res.data, `pl_report_${selectedMonth}.csv`);
      toast.success("P&L report downloaded!");
    } catch { toast.error("Download failed"); }
  };

  if (isLoading) return <PageSpinner />;

  const { engineers = [], totals = {} } = data || {};
  const monthLabel = months.find((m) => m.prefix === selectedMonth)?.fullLabel || selectedMonth;

  const chartData = engineers.map((e) => ({
    name: e.name.split(" ")[0],
    Revenue: Math.round(e.revenue),
    Incentive: Math.round(e.incentive),
    "Acc. Cost": Math.round(e.accessoriesCost),
    "P&L": Math.round(e.pl),
  }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <h1 className="text-xl font-bold">Monthly P&L Report</h1>
        <div className="flex flex-wrap items-center gap-2">
          {months.map((m) => (
            <Button
              key={m.prefix}
              size="sm"
              variant={m.prefix === selectedMonth ? "primary" : "default"}
              onClick={() => setSelectedMonth(m.prefix)}
            >
              {m.label}
            </Button>
          ))}
          <Button size="sm" onClick={handleDownload}>
            <i className="ti ti-download" /> CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total Revenue" value={formatCurrency(totals.revenue)} sub={monthLabel} color="accent" />
        <MetricCard label="Total Incentive" value={formatCurrency(totals.incentive)} color="amber" />
        <MetricCard label="Accessories Cost" value={formatCurrency(totals.accessoriesCost)} color="red" />
        <MetricCard label="Net P&L" value={formatCurrency(totals.pl)} color={totals.pl >= 0 ? "green" : "red"} />
      </div>

      {chartData.length > 0 && (
        <Card className="mb-5">
          <CardTitle>Engineer Performance — {monthLabel}</CardTitle>
          <div className="mt-3" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 12, left: 4, bottom: 4 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={SHORT} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  formatter={(v, name) => [INR(v), name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                <Bar dataKey="Revenue" fill="#3b5bdb" radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar dataKey="Incentive" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar dataKey="Acc. Cost" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar dataKey="P&L" radius={[3, 3, 0, 0]} maxBarSize={20}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry["P&L"] >= 0 ? "#16a34a" : "#dc2626"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Engineer-wise P&L — {monthLabel}</h3>
          <span className="text-xs text-muted">P&L = Revenue − Incentive − Accessories Cost</span>
        </div>
        <div className="overflow-x-auto tbl">
          <table>
            <thead>
              <tr>
                <th>Engineer</th>
                <th>Revenue</th>
                <th>Incentive Paid</th>
                <th>Accessories Cost</th>
                <th>P&L</th>
              </tr>
            </thead>
            <tbody>
              {engineers.map((row) => (
                <tr key={row.engineerId}>
                  <td><strong>{row.name}</strong></td>
                  <td>{formatCurrency(row.revenue)}</td>
                  <td><IncentivePill amount={row.incentive} /></td>
                  <td>{formatCurrency(row.accessoriesCost)}</td>
                  <td className={row.pl >= 0 ? "pl-pos" : "pl-neg"}>
                    {row.pl >= 0 ? "+" : ""}{formatCurrency(row.pl)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-bg font-bold">
                <td>TOTAL</td>
                <td>{formatCurrency(totals.revenue)}</td>
                <td>{formatCurrency(totals.incentive)}</td>
                <td>{formatCurrency(totals.accessoriesCost)}</td>
                <td className={totals.pl >= 0 ? "pl-pos" : "pl-neg"}>
                  {totals.pl >= 0 ? "+" : ""}{formatCurrency(totals.pl)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
