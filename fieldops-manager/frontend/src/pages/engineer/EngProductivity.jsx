import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import { productivityService } from "../../services/productivityService";
import Card from "../../components/common/Card";
import Button from "../../components/common/Button";
import FormField, { inputClass, selectClass } from "../../components/common/FormField";

export default function EngProductivity() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(today);
  const [calls, setCalls] = useState("");
  const [lineItems, setLineItems] = useState([]);

  const { data: skusRes } = useQuery({
    queryKey: ["skus"],
    queryFn: () => api.get("/skus").then((r) => r.data.data),
  });
  const skus = skusRes || [];

  const addLine = () =>
    setLineItems([...lineItems, { id: Date.now(), skuId: skus[0]?.id || "", qty: "", saleValue: "" }]);

  const removeLine = (id) => setLineItems(lineItems.filter((l) => l.id !== id));

  const updateLine = (id, field, value) =>
    setLineItems(lineItems.map((l) => (l.id === id ? { ...l, [field]: value } : l)));

  const mutation = useMutation({
    mutationFn: (data) => productivityService.createLog(data),
    onSuccess: () => {
      toast.success("Productivity logged! Awaiting Team Leader validation.");
      queryClient.invalidateQueries({ queryKey: ["eng-dashboard"] });
      navigate("/engineer/status");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to submit log");
    },
  });

  const handleSubmit = () => {
    if (!date) { toast.error("Please select a date"); return; }

    const items = lineItems
      .filter((l) => parseInt(l.qty) > 0)
      .map((l) => ({ skuId: l.skuId, qty: parseInt(l.qty), saleValue: parseFloat(l.saleValue) || 0 }));

    mutation.mutate({ date, callsClosed: parseInt(calls) || 0, items });
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Log Daily Productivity</h1>
      </div>

      <Card className="max-w-[680px]">
        <FormField label="Date" required>
          <input
            type="date"
            className={inputClass}
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
          />
        </FormField>

        <FormField label="Calls Closed">
          <input
            type="number"
            className={inputClass}
            min={0}
            max={30}
            value={calls}
            onChange={(e) => setCalls(e.target.value)}
            placeholder="Number of service calls closed today"
          />
        </FormField>

        <hr className="border-border my-5" />
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Accessories Sold</h3>
          <span className="text-xs text-muted">Optional</span>
        </div>

        {lineItems.map((line) => (
          <div key={line.id} className="line-item-row">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">SKU</label>
              <select
                className={selectClass}
                value={line.skuId}
                onChange={(e) => updateLine(line.id, "skuId", e.target.value)}
              >
                {skus.map((s) => (
                  <option key={s.id} value={s.id}>{s.id} – {s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">Qty Sold</label>
              <input
                type="number"
                className={inputClass}
                min={1}
                value={line.qty}
                onChange={(e) => updateLine(line.id, "qty", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">Sale Value (₹)</label>
              <input
                type="number"
                className={inputClass}
                min={0}
                value={line.saleValue}
                onChange={(e) => updateLine(line.id, "saleValue", e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="pb-0.5">
              <Button variant="danger" size="sm" onClick={() => removeLine(line.id)}>
                <i className="ti ti-x" />
              </Button>
            </div>
          </div>
        ))}

        <Button variant="ghost" size="sm" onClick={addLine} className="mb-5">
          <i className="ti ti-plus" /> Add Accessory Line
        </Button>

        <hr className="border-border my-5" />
        <div className="flex gap-2 justify-end">
          <Button onClick={() => navigate("/engineer/dashboard")}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={mutation.isPending}>
            <i className="ti ti-send" />
            {mutation.isPending ? "Submitting..." : "Submit for Validation"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
