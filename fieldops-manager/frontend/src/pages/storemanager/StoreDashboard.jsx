import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import MetricCard from "../../components/common/MetricCard";
import Card, { CardTitle } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Alert from "../../components/common/Alert";
import SkuTag from "../../components/common/SkuTag";
import { PageSpinner } from "../../components/common/Spinner";
import { formatDate, formatCurrency } from "../../utils/formatters";

export default function StoreDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["store-dashboard"],
    queryFn: () => api.get("/dashboard/store").then((r) => r.data.data),
  });

  if (isLoading) return <PageSpinner />;

  const {
    pendingStockRequests = 0,
    pendingPurchaseInward = 0,
    lowStockSkus = [],
    totalInventoryValue = 0,
    recentPurchase = [],
  } = data || {};

  return (
    <div>
      <div className="mb-5"><h1 className="text-xl font-bold">Store Dashboard</h1></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Pending Stock Requests" value={pendingStockRequests} color="accent" />
        <MetricCard label="Purchase Inward (Pending Admin)" value={pendingPurchaseInward} color="amber" />
        <MetricCard label="Low Stock SKUs" value={lowStockSkus.length} color="red" />
        <MetricCard label="Total Inventory Value" value={formatCurrency(totalInventoryValue)} color="green" />
      </div>

      {pendingPurchaseInward > 0 && (
        <Alert variant="warn">
          <strong>{pendingPurchaseInward} purchase inward entries</strong> are awaiting Admin approval.
        </Alert>
      )}

      {lowStockSkus.length > 0 && (
        <Alert variant="danger">
          <strong>Low stock:</strong> {lowStockSkus.map((s) => s.name).join(", ")}
        </Alert>
      )}

      <Card>
        <CardTitle>Recent Purchase Inward</CardTitle>
        <div className="overflow-x-auto tbl">
          <table>
            <thead>
              <tr><th>Date</th><th>SKU</th><th>Item</th><th>Qty</th><th>Vendor</th><th>Status</th></tr>
            </thead>
            <tbody>
              {recentPurchase.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.date)}</td>
                  <td><SkuTag id={p.skuId} /></td>
                  <td>{p.sku?.name}</td>
                  <td>+{p.qty}</td>
                  <td>{p.vendor}</td>
                  <td><Badge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
