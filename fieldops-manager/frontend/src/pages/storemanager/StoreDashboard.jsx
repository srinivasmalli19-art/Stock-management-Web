import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import MetricCard from "../../components/common/MetricCard";
import Card, { CardTitle } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Alert from "../../components/common/Alert";
import EmptyState from "../../components/common/EmptyState";
import SkuTag from "../../components/common/SkuTag";
import { PageSpinner } from "../../components/common/Spinner";
import { formatDate, formatCurrency } from "../../utils/formatters";

export default function StoreDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["store-dashboard"],
    queryFn: () => api.get("/dashboard/store").then((r) => r.data.data),
  });

  const { data: claimData } = useQuery({
    queryKey: ["store-claim-requests"],
    queryFn: () => api.get("/claim-requests").then((r) => r.data.data),
    staleTime: 30000,
  });

  if (isLoading) return <PageSpinner />;

  const {
    pendingStockRequests = 0,
    pendingPurchaseInward = 0,
    lowStockSkus = [],
    totalInventoryValue = 0,
    recentPurchase = [],
  } = data || {};
  const claimList = claimData || [];
  const pendingClaims = claimList.filter((c) => c.status === "CLAIM_VALIDATION_PENDING").length;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-3xl font-bold">Store Dashboard</h1>
        <p className="text-sm text-muted mt-0.5">Inventory, stock requests, and purchase management</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <MetricCard label="Pending Stock Requests" value={pendingStockRequests} color="accent" />
        <MetricCard label="Purchase Inward (Pending Admin)" value={pendingPurchaseInward} color="amber" />
        <MetricCard label="Low Stock SKUs" value={lowStockSkus.length} color="red" />
        <MetricCard label="Total Inventory Value" value={formatCurrency(totalInventoryValue)} color="green" />
      </div>
      <div className="grid grid-cols-1 gap-3 mb-5">
        <MetricCard label="Claims Pending Validation" value={pendingClaims} sub={pendingClaims > 0 ? "LP claims awaiting your review" : "no claims pending"} color={pendingClaims > 0 ? "red" : "green"} />
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
              {recentPurchase.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon="ti-package-import"
                      message="No purchase entries yet"
                      sub="Purchase inward entries created by your team will appear here."
                    />
                  </td>
                </tr>
              ) : (
                recentPurchase.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.date)}</td>
                    <td><SkuTag id={p.skuId} /></td>
                    <td>{p.sku?.name}</td>
                    <td>+{p.qty}</td>
                    <td>{p.vendor}</td>
                    <td><Badge status={p.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
