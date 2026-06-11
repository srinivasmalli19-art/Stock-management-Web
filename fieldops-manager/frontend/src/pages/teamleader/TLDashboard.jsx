import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import IncentivePill from "../../components/common/IncentivePill";
import { PageSpinner } from "../../components/common/Spinner";
import { formatCurrency, formatMonth, getCurrentMonthPrefix } from "../../utils/formatters";

export default function TLDashboard() {
  const prefix = getCurrentMonthPrefix();

  const { data, isLoading } = useQuery({
    queryKey: ["tl-dashboard"],
    queryFn: () => api.get("/dashboard/team-leader").then((r) => r.data.data),
  });

  if (isLoading) return <PageSpinner />;

  const engineers = data || [];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Team Performance — {formatMonth(prefix)}</h1>
      </div>

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
