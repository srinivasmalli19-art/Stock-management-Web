import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import notificationService from "../../services/notificationService";
import Card, { CardTitle } from "../../components/common/Card";
import Button from "../../components/common/Button";
import { PageSpinner } from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import { timeAgo } from "../../utils/formatters";

const TYPE_CONFIG = {
  approved:        { icon: "ti-circle-check",  color: "text-success", label: "Approved" },
  rejected:        { icon: "ti-circle-x",       color: "text-danger",  label: "Rejected" },
  action_required: { icon: "ti-bell-ringing",   color: "text-warn",    label: "Action Required" },
  info:            { icon: "ti-info-circle",    color: "text-accent",  label: "Info" },
};

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "action_required", label: "Action Required" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "info", label: "Info" },
];

export default function Notifications() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", { typeFilter, unreadOnly, page }],
    queryFn: () => notificationService.getAll({
      limit: LIMIT,
      page,
      ...(unreadOnly ? { unreadOnly: "true" } : {}),
    }),
    staleTime: 10000,
    placeholderData: (prev) => prev,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notification-count"] });
    qc.invalidateQueries({ queryKey: ["notifications-preview"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markRead = useMutation({
    mutationFn: notificationService.markRead,
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: () => {
      invalidate();
      toast.success("All notifications marked as read");
    },
    onError: () => toast.error("Failed to mark notifications as read"),
  });

  if (isLoading) return <PageSpinner />;

  const allItems = data?.data || [];

  // Client-side search filter (by title + message)
  const items = search.trim()
    ? allItems.filter((n) =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.message.toLowerCase().includes(search.toLowerCase())
      )
    : allItems;

  // Client-side type filter
  const filtered = typeFilter
    ? items.filter((n) => n.type === typeFilter)
    : items;

  const pagination = data?.pagination;
  const unreadCount = filtered.filter((n) => !n.isRead).length;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold">Notifications</h1>
          <p className="text-sm text-muted mt-0.5">Your activity feed across all workflows</p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <i className="ti ti-checks" /> Mark all read
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          className="input flex-1"
          placeholder="Search notifications…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          aria-label="Search notifications"
        />
        <select
          className="input sm:w-44"
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          aria-label="Filter by type"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg cursor-pointer hover:bg-gray-50 text-sm select-none shrink-0">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }}
            className="w-3.5 h-3.5 accent-[color:var(--accent)]"
          />
          Unread only
        </label>
      </div>

      <Card padding={false}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="ti-bell-off"
            message={unreadOnly ? "No unread notifications" : "No notifications found"}
            sub={search ? `No results for "${search}"` : "New activity across workflows will appear here."}
          />
        ) : (
          <div>
            {filtered.map((n) => {
              const { icon, color } = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 px-5 py-4 border-b border-border last:border-0 transition-colors ${
                    !n.isRead
                      ? "border-l-[3px] border-l-accent bg-accent2/10 hover:bg-accent2/20"
                      : "border-l-[3px] border-l-transparent hover:bg-gray-50"
                  }`}
                >
                  <i className={`ti ${icon} ${color} text-2xl mt-0.5 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-text">{n.title}</p>
                        <p className="text-sm text-muted mt-0.5 leading-relaxed">{n.message}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted">{timeAgo(n.createdAt)}</div>
                        {!n.isRead && (
                          <button
                            onClick={() => markRead.mutate(n.id)}
                            disabled={markRead.isPending}
                            className="text-[10px] text-accent font-medium hover:underline mt-1 disabled:opacity-50"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" aria-label="Unread" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted text-xs">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <i className="ti ti-chevron-left" /> Prev
            </Button>
            <Button
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <i className="ti ti-chevron-right" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
