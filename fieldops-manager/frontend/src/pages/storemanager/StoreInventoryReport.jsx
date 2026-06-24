import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import { reportService } from "../../services/reportService";
import Card, { CardTitle } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Tabs from "../../components/common/Tabs";
import SkuTag from "../../components/common/SkuTag";
import MetricCard from "../../components/common/MetricCard";
import { PageSpinner } from "../../components/common/Spinner";
import { formatCurrency, triggerDownload } from "../../utils/formatters";

export default function StoreInventoryReport() {
  const [tab, setTab] = useState("inventory");

  const { data: invRes, isLoading } = useQuery({
    queryKey: ["inventory-main"],
    queryFn: () => api.get("/inventory/main").then((r) => r.data.data),
  });

  const { data: supplierRes } = useQuery({
    queryKey: ["supplier-report"],
    queryFn: () => api.get("/reports/purchase/supplier").then((r) => r.data.data),
  });

  const inventory = invRes || [];
  const suppliers = supplierRes || [];

  const totalValue = inventory.reduce((s, i) => s + i.totalValue, 0);
  const totalQty = inventory.reduce((s, i) => s + i.qty, 0);
  const lowCount = inventory.filter((i) => i.isLowStock).length;

  const handleDownloadInventory = async () => {
    try {
      const res = await api.get("/inventory/main/csv", { responseType: "blob" });
      triggerDownload(res.data, "inventory_report.csv");
      toast.success("Inventory report downloaded!");
    } catch { toast.error("Download failed"); }
  };

  const handleDownloadSupplier = async () => {
    try {
      const res = await api.get("/reports/purchase/supplier/csv", { responseType: "blob" });
      triggerDownload(res.data, "supplier_report.csv");
      toast.success("Supplier report downloaded!");
    } catch { toast.error("Download failed"); }
  };

  if (isLoading) return <PageSpinner />;

  const tabs = [
    { key: "inventory", label: "Main Inventory" },
    { key: "supplier", label: "Supplier-wise Purchase Report" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">Inventory Report</h1>
        <Button size="sm" onClick={tab === "inventory" ? handleDownloadInventory : handleDownloadSupplier}>
          <i className="ti ti-download" /> Download CSV
        </Button>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "inventory" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <MetricCard label="Total SKUs" value={inventory.length} color="accent" />
            <MetricCard label="Total Units" value={totalQty.toLocaleString("en-IN")} color="green" />
            <MetricCard label="Inventory Value" value={formatCurrency(totalValue)} color="accent" />
            <MetricCard label="Low Stock Items" value={lowCount} sub="Below alert threshold" color="red" />
          </div>
          <Card>
            <CardTitle>Warehouse Stock Levels</CardTitle>
            <div className="overflow-x-auto tbl">
              <table>
                <thead>
                  <tr><th>SKU ID</th><th>Item Name</th><th>Qty</th><th>Alert</th><th>Unit Price</th><th>Total Value</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {inventory.map((i) => (
                    <tr key={i.skuId}>
                      <td><SkuTag id={i.skuCode} /></td>
                      <td>{i.skuName}</td>
                      <td>
                        <strong>{i.qty}</strong>
                        <div className="progress-bar w-20 mt-1">
                          <div className="progress-fill" style={{ width: `${Math.min(100, (i.qty / 300) * 100)}%`, background: i.isLowStock ? "var(--danger)" : "var(--success)" }} />
                        </div>
                      </td>
                      <td>{i.lowStockAlert}</td>
                      <td>{formatCurrency(i.unitPrice)}</td>
                      <td>{formatCurrency(i.totalValue)}</td>
                      <td><Badge status={i.isLowStock ? "Low" : "OK"} /></td>
                    </tr>
                  ))}
                  <tr className="bg-bg font-bold">
                    <td colSpan={5}>TOTAL</td>
                    <td>{formatCurrency(totalValue)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === "supplier" && (
        <Card>
          <CardTitle>Supplier-wise Purchase Report</CardTitle>
          <div className="overflow-x-auto tbl">
            <table>
              <thead>
                <tr><th>Vendor / Supplier</th><th>Purchase Entries</th><th>Total Qty Received</th><th>Total Purchase Value</th></tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-muted py-5">No approved purchase data</td></tr>
                ) : (
                  suppliers.map((v) => (
                    <tr key={v.vendor}>
                      <td><strong>{v.vendor}</strong></td>
                      <td>{v.entries.length}</td>
                      <td>{v.totalQty}</td>
                      <td><strong>{formatCurrency(v.totalValue)}</strong></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
