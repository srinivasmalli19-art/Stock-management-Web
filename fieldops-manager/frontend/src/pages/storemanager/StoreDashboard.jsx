import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import MetricCard from "../../components/common/MetricCard";
import Card, { CardTitle } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Alert from "../../components/common/Alert";
import EmptyState from "../../components/common/EmptyState";
import SkuTag from "../../components/common/SkuTag";
import { PageSpinner } from "../../components/common/Spinner";
import ActivityTimeline from "../../components/dashboard/ActivityTimeline";
import QuickActions from "../../components/dashboard/QuickActions";
import PendingActions from "../../components/dashboard/PendingActions";
import TodaySummary from "../../components/dashboard/TodaySummary";
import { formatDate, formatCurrency } from "../../utils/formatters";

const QUICK_ACTIONS = [
  { label: "Purchase Inward", icon: "ti-truck-delivery", to: "/store/inward"     },
  { label: "Stock Requests",  icon: "ti-package",        to: "/store/requests"   },
  { label: "Inventory",       icon: "ti-warehouse",      to: "/store/inventory"  },
  { label: "LP Claims",       icon: "ti-receipt",        to: "/store/lp-requests"},
];

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

  const { data: widgets } = useQuery({
    queryKey: ["dashboard-widgets", "sm"],
    queryFn: () => api.get("/dashboard/widgets").then((r) => r.data.data),
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

  const w = widgets || {};
  const pending = w.pending || {};
  const today = w.today || {};

  const pendingItems = [
    { label: "Stock Requests Pending",      count: pending.stockRequests   || 0, to: "/store/requests",    color: "accent" },
    { label: "Purchase Inward (Admin Review)", count: pending.purchaseInward || 0, to: "/store/inward",      color: "amber"  },
    { label: "Claims Awaiting Validation",  count: pending.claimValidations || 0, to: "/store/lp-requests", color: "purple" },
  ];

  const todayStats = [
    { label: "Stock Requests Today",   value: today.stockRequestsToday   || 0, icon: "ti-package",          color: "accent" },
    { label: "Purchase Entries Today", value: today.purchaseInwardToday  || 0, icon: "ti-truck-delivery",   color: "green"  },
    { label: "Low Stock SKUs",         value: lowStockSkus.length,             icon: "ti-alert-triangle",   color: "amber"  },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-5xl font-extrabold text-text tracking-tight">Store Dashboard</h1>
        <p className="text-sm text-muted mt-0.5">Inventory, stock requests, and purchase management</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <MetricCard label="Pending Stock Requests" value={pendingStockRequests} color="accent" icon="ti-package" />
        <MetricCard label="Purchase Inward (Pending Admin)" value={pendingPurchaseInward} color="amber" icon="ti-truck-delivery" />
        <MetricCard label="Low Stock SKUs" value={lowStockSkus.length} color="red" icon="ti-alert-triangle" />
        <MetricCard label="Total Inventory Value" value={formatCurrency(totalInventoryValue)} color="green" icon="ti-currency-rupee" />
      </div>
      <div className="grid grid-cols-1 gap-3 mb-5">
        <MetricCard label="Claims Pending Validation" value={pendingClaims} sub={pendingClaims > 0 ? "LP claims awaiting your review" : "no claims pending"} color={pendingClaims > 0 ? "red" : "green"} icon="ti-receipt" />
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
                    <td><SkuTag id={p.sku?.code} /></td>
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
