import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import Button from "../../components/common/Button";
import Tabs from "../../components/common/Tabs";
import { PageSpinner } from "../../components/common/Spinner";
import { formatDate } from "../../utils/formatters";

const TABS = [
  { key: "Pending", label: "Pending" },
  { key: "Approved", label: "Approved" },
  { key: "Rejected", label: "Rejected" },
];

const ATTENDANCE_COLOR = {
  Present: "text-green-600",
  Absent: "text-red-600",
  Half_Day: "text-yellow-600",
  Leave: "text-blue-600",
};

export default function AdminAttendanceApproval() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("Pending");
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["staff-attendance-admin", tab],
    queryFn: () =>
      api.get("/staff-attendance", { params: { status: tab } }).then((r) => r.data.data),
  });

  const approveMut = useMutation({
    mutationFn: (id) => api.patch(`/staff-attendance/${id}/approve`),
    onSuccess: () => {
      toast.success("Attendance approved — ledger entry created");
      qc.invalidateQueries({ queryKey: ["staff-attendance-admin"] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Approval failed"),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, rejectedReason }) =>
      api.patch(`/staff-attendance/${id}/reject`, { rejectedReason }),
    onSuccess: () => {
      toast.success("Attendance rejected");
      qc.invalidateQueries({ queryKey: ["staff-attendance-admin"] });
      setRejectId(null);
      setRejectReason("");
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Rejection failed"),
  });

  const records = data || [];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Attendance Approval</h1>
        <p className="text-sm text-muted mt-0.5">
          Review TL and SM attendance submissions
        </p>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={(t) => { setTab(t); setRejectId(null); }} />

      {isLoading ? (
        <PageSpinner />
      ) : (
        <Card>
          <CardTitle right={`${records.length} record${records.length !== 1 ? "s" : ""}`}>
            {tab} Submissions
          </CardTitle>
          <div className="overflow-x-auto tbl">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Submitted</th>
                  {tab === "Rejected" && <th>Rejected Reason</th>}
                  {tab === "Approved" && <th>Approved By</th>}
                  {tab === "Pending" && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-6">
                      No {tab.toLowerCase()} attendance records
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className="font-medium">{r.user?.name}</span>
                        <div className="text-xs text-muted">{r.user?.email}</div>
                      </td>
                      <td className="text-sm text-muted">
                        {r.user?.role?.replace(/_/g, " ")}
                      </td>
                      <td>{formatDate(r.date)}</td>
                      <td>
                        <span className={`text-sm font-semibold ${ATTENDANCE_COLOR[r.attendanceStatus] || ""}`}>
                          {r.attendanceStatus}
                        </span>
                      </td>
                      <td className="text-sm text-muted max-w-[200px] truncate">
                        {r.remarks || "—"}
                      </td>
                      <td className="text-xs text-muted">{formatDate(r.createdAt)}</td>

                      {tab === "Rejected" && (
                        <td className="text-xs text-danger">{r.rejectedReason || "—"}</td>
                      )}
                      {tab === "Approved" && (
                        <td className="text-sm">{r.approvedByName || "—"}</td>
                      )}
                      {tab === "Pending" && (
                        <td>
                          {rejectId === r.id ? (
                            <div className="flex flex-col gap-1.5 min-w-[200px]">
                              <input
                                className="input text-xs"
                                placeholder="Rejection reason (optional)"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                              />
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() =>
                                    rejectMut.mutate({ id: r.id, rejectedReason: rejectReason })
                                  }
                                  disabled={rejectMut.isPending}
                                >
                                  Confirm Reject
                                </Button>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => { setRejectId(null); setRejectReason(""); }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() => approveMut.mutate(r.id)}
                                disabled={approveMut.isPending}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => { setRejectId(r.id); setRejectReason(""); }}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </td>
                      )}
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
