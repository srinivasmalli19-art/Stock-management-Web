import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import EmptyState from "../../components/common/EmptyState";
import { PageSpinner } from "../../components/common/Spinner";
import { formatDate, formatCurrency, genId } from "../../utils/formatters";
import { inputClass } from "../../components/common/FormField";

const schema = z.object({
  jobId: z.string().min(1, "Job ID is required"),
  spareCost: z.coerce.number().min(0, "Must be 0 or more"),
  serviceCost: z.coerce.number().min(0, "Must be 0 or more"),
  date: z.string().min(1, "Date is required"),
  tlEmail: z.string().email("Select a valid Team Leader"),
});

const STATUS_ORDER = ["Pending", "Claim_Pending", "Claim_Submitted", "Claim_Forwarded", "Claim_Approved"];

const STEP_LABELS = {
  Pending: "Submitted",
  Claim_Pending: "TL Approved",
  Claim_Submitted: "Store Processing",
  Claim_Forwarded: "Forwarded to Admin",
  Claim_Approved: "Approved",
};

export default function EngLPRequests() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["eng-lp-requests"],
    queryFn: () => api.get("/lp-requests").then((r) => r.data.data),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const { data: teamLeaders = [] } = useQuery({
    queryKey: ["team-leaders"],
    queryFn: () => api.get("/users/team-leaders").then((r) => r.data.data),
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      jobId: "",
      spareCost: 0,
      serviceCost: 0,
      date: new Date().toISOString().split("T")[0],
      tlEmail: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post("/lp-requests", data),
    onSuccess: () => {
      toast.success("LP request submitted to your Team Leader");
      qc.invalidateQueries({ queryKey: ["eng-lp-requests"] });
      setShowModal(false);
      reset();
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Submission failed"),
  });

  const onSubmit = (data) => createMutation.mutate(data);
  const fillJobId = () => setValue("jobId", genId("JOB"));

  if (isLoading) return <PageSpinner />;

  const list = requests || [];
  const activeCount = list.filter((r) => !["Claim_Approved", "Rejected"].includes(r.status)).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">My LP (Labour & Parts) Requests</h1>
          <p className="text-sm text-muted mt-0.5">Submit claims for labour and parts on completed jobs</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <i className="ti ti-plus" /> New Request
        </Button>
      </div>

      {activeCount > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
          <i className="ti ti-info-circle mr-2" />
          {activeCount} request{activeCount > 1 ? "s" : ""} in progress
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState icon="ti-file-invoice" message="No LP requests yet. Submit your first claim." />
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{r.jobId}</span>
                    <Badge status={r.status} />
                  </div>
                  <div className="text-xs text-muted">Submitted: {formatDate(r.date)}</div>
                  <div className="text-xs text-muted mt-0.5">TL: {r.tlEmail}</div>
                  {r.note && <div className="text-xs text-amber-700 mt-1 italic">Note: {r.note}</div>}
                </div>
                <div className="flex gap-6 text-right shrink-0">
                  <div>
                    <div className="text-xs text-muted">Spare</div>
                    <div className="font-semibold text-sm">{formatCurrency(r.spareCost)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Service</div>
                    <div className="font-semibold text-sm">{formatCurrency(r.serviceCost)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Total</div>
                    <div className="font-semibold text-sm text-accent">
                      {formatCurrency(r.spareCost + r.serviceCost)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress stepper */}
              <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
                {r.status === "Rejected" ? (
                  <div className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                    <i className="ti ti-x text-xs mr-1" />Rejected
                    {r.note && <span className="ml-1 opacity-75">— {r.note}</span>}
                  </div>
                ) : (
                  STATUS_ORDER.map((step, idx, arr) => {
                    const currentIdx = STATUS_ORDER.indexOf(r.status);
                    const stepIdx = STATUS_ORDER.indexOf(step);
                    const isDone = currentIdx >= stepIdx;
                    const isActive = r.status === step;
                    return (
                      <div key={step} className="flex items-center gap-1">
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                          isDone
                            ? isActive
                              ? "bg-accent text-white"
                              : "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-400"
                        }`}>
                          {isDone && !isActive ? <i className="ti ti-check text-xs" /> : null}
                          {STEP_LABELS[step]}
                        </div>
                        {idx < arr.length - 1 && (
                          <i className="ti ti-chevron-right text-xs text-gray-300 shrink-0" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); reset(); }}
        title="New LP Request"
        width="480px"
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="mb-3">
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">Job ID</label>
            <div className="flex gap-2">
              <input {...register("jobId")} className={inputClass} placeholder="e.g. JOB-20240614-A3F" />
              <Button type="button" variant="default" size="sm" onClick={fillJobId}>Generate</Button>
            </div>
            {errors.jobId && <p className="text-xs text-danger mt-1">{errors.jobId.message}</p>}
          </div>

          <div className="mb-3">
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">Team Leader</label>
            <select {...register("tlEmail")} className={inputClass}>
              <option value="">— Select your Team Leader —</option>
              {teamLeaders.map((tl) => (
                <option key={tl.id} value={tl.email}>{tl.name} ({tl.email})</option>
              ))}
            </select>
            {errors.tlEmail && <p className="text-xs text-danger mt-1">{errors.tlEmail.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">Spare Cost (₹)</label>
              <input {...register("spareCost")} type="number" min="0" step="0.01" className={inputClass} />
              {errors.spareCost && <p className="text-xs text-danger mt-1">{errors.spareCost.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">Service Cost (₹)</label>
              <input {...register("serviceCost")} type="number" min="0" step="0.01" className={inputClass} />
              {errors.serviceCost && <p className="text-xs text-danger mt-1">{errors.serviceCost.message}</p>}
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">Job Date</label>
            <input {...register("date")} type="date" className={inputClass} />
            {errors.date && <p className="text-xs text-danger mt-1">{errors.date.message}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="default" onClick={() => { setShowModal(false); reset(); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Submitting…" : "Submit to TL"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
