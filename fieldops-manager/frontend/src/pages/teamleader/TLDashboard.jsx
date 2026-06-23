import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import MetricCard from "../../components/common/MetricCard";
import IncentivePill from "../../components/common/IncentivePill";
import { PageSpinner } from "../../components/common/Spinner";
import ActivityTimeline from "../../components/dashboard/ActivityTimeline";
import QuickActions from "../../components/dashboard/QuickActions";
import PendingActions from "../../components/dashboard/PendingActions";
import TodaySummary from "../../components/dashboard/TodaySummary";
import { formatCurrency, formatMonth, getCurrentMonthPrefix } from "../../utils/formatters";

const INR = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;
const SHORT = (v) => `₹${(v / 1000).toFixed(0)}k`;

const QUICK_ACTIONS = [
  { label: "Validation Queue",  icon: "ti-check-list",     to: "/tl/approvals"    },
  { label: "My Attendance",     icon: "ti-calendar-check", to: "/tl/attendance"   },
  { label: "LP Requests",       icon: "ti-receipt",        to: "/tl/lp-requests"  },
  { label: "Team Dashboard",    icon: "ti-layout-dashboard",to: "/tl/dashboard"   },
];

export default function TLDashboard() {
  const prefix = getCurrentMonthPrefix();

  const { data, isLoading } = useQuery({
    queryKey: ["tl-dashboard"],
    queryFn: () => api.get("/dashboard/team-leader").then((r) => r.data.data),
  });

  const { data: productivityData } = useQuery({
    queryKey: ["tl-queue"],
    queryFn: () => api.get("/productivity").then((r) => r.data.data),
    staleTime: 30000,
  });

  const { data: lpData } = useQuery({
    queryKey: ["tl-lp-requests"],
    queryFn: () => api.get("/lp-requests").then((r) => r.data.data),
    staleTime: 30000,
  });

  const { data: claimData } = useQuery({
    queryKey: ["tl-claim-requests"],
    queryFn: () => api.get("/claim-requests").then((r) => r.data.data),
    staleTime: 30000,
  });

  const { data: widgets } = useQuery({
    queryKey: ["dashboard-widgets", "tl"],
    queryFn: () => api.get("/dashboard/widgets").then((r) => r.data.data),
    staleTime: 30000,
  });

  if (isLoading) return <PageSpinner />;

  const engineers = data || [];
  const allLogs = productivityData || [];
  const lpList = lpData || [];
  const claimList = claimData || [];
  const pendingValidations = allLogs.filter((l) => l.status === "Pending").length;
  const pendingLP = lpList.filter((r) => r.status === "LP_PENDING_ADMIN_APPROVAL").length;
  const activeClaims = claimList.filter((c) => ["CLAIM_VALIDATION_PENDING", "CLAIM_ADMIN_APPROVAL_PENDING"].includes(c.status)).length;

  const w = widgets || {};
  const pending = w.pending || {};
  const today = w.today || {};

  const pendingItems = [
    { label: "Productivity Pending Validation", count: pending.validations || 0, to: "/tl/approvals",   color: "amber"  },
    { label: "Staff Attendance Pending",        count: pending.attendance  || 0, to: "/tl/attendance",  color: "accent" },
    { label: "LP Requests (Admin Review)",      count: pending.lpRequests  || 0, to: "/tl/lp-requests", color: "purple" },
  ];

  const todayStats = [
    { label: "Validated Today",    value: today.validatedToday   || 0, icon: "ti-check",      color: "green"  },
    { label: "Pending Validation", value: today.pendingValidation || 0, icon: "ti-clock",      color: "amber"  },
    { label: "Active Claims",      value: activeClaims,               icon: "ti-file-dollar", color: "purple" },
  ];

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
        <h1 className="text-3xl font-bold">Team Performance — {formatMonth(prefix)}</h1>
        <p className="text-sm text-muted mt-0.5">Month-to-date metrics across all engineers</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
        <MetricCard label="Team Calls (MTD)" value={totals.calls} color="accent" />
        <MetricCard label="Team Revenue (MTD)" value={formatCurrency(totals.revenue)} color="green" />
        <MetricCard label="Total Incentive Paid" value={formatCurrency(totals.incentive)} color="amber" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Link to="/tl/approvals" className="block hover:shadow-md transition-shadow rounded-lg">
          <MetricCard label="Pending Validations" value={pendingValidations} sub={pendingValidations > 0 ? "tap to review →" : "all caught up"} color={pendingValidations > 0 ? "red" : "green"} />
        </Link>
        <Link to="/tl/lp-requests" className="block hover:shadow-md transition-shadow rounded-lg">
          <MetricCard label="LP Requests" value={lpList.length} sub={pendingLP > 0 ? "tap to review →" : `${pendingLP} awaiting Admin`} color={pendingLP > 0 ? "amber" : "accent"} />
        </Link>
        <Link to="/tl/lp-requests" className="block hover:shadow-md transition-shadow rounded-lg">
          <MetricCard label="Active Claims" value={activeClaims} sub={activeClaims > 0 ? "tap to review →" : "none in progress"} color={activeClaims > 0 ? "amber" : "green"} />
        </Link>
      </div>

      {/* Phase E widgets */}
      <div className="mb-4">
        <QuickActions actions={QUICK_ACTIONS} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <PendingActions items={pendingItems} />
        <TodaySummary stats={todayStats} />
      </div>

      <div className="mb-5">
        <ActivityTimeline />
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
