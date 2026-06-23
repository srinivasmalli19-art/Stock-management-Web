import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import notificationService from "../../services/notificationService";
import { timeAgo } from "../../utils/formatters";

const TYPE_CONFIG = {
  approved:        { icon: "ti-circle-check",  color: "text-success" },
  rejected:        { icon: "ti-circle-x",       color: "text-danger"  },
  action_required: { icon: "ti-bell-ringing",   color: "text-warn"    },
  info:            { icon: "ti-info-circle",    color: "text-accent"  },
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const qc = useQueryClient();

  // Close dropdown when user clicks outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: count = 0 } = useQuery({
    queryKey: ["notification-count"],
    queryFn: notificationService.getUnreadCount,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: notifRes } = useQuery({
    queryKey: ["notifications-preview"],
    queryFn: () => notificationService.getAll({ limit: 10 }),
    enabled: open,
    staleTime: 10000,
  });

  const notifications = notifRes?.data || [];

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
    onSuccess: invalidate,
  });

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `${count} unread notifications` : "Notifications"}
        className="relative p-1.5 rounded-lg text-muted hover:text-text hover:bg-gray-100 transition-colors"
      >
        <i className="ti ti-bell text-xl" />
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none pointer-events-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h4 className="text-sm font-semibold text-text">Notifications</h4>
            {count > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[340px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <i className="ti ti-bell-off text-2xl text-muted opacity-30 block mb-2" />
                <p className="text-sm text-muted">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((n) => {
                const { icon, color } = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
                return (
                  <button
                    key={n.id}
                    className={`w-full text-left flex gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-accent2/30 transition-colors ${
                      !n.isRead ? "border-l-[3px] border-l-accent bg-accent2/10" : "border-l-[3px] border-l-transparent"
                    }`}
                    onClick={() => { if (!n.isRead) markRead.mutate(n.id); }}
                  >
                    <i className={`ti ${icon} ${color} text-xl mt-0.5 shrink-0`} />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-text leading-snug">{n.title}</div>
                      <div className="text-xs text-muted mt-0.5 leading-relaxed line-clamp-2">{n.message}</div>
                      <div className="text-[10px] text-muted mt-1">{timeAgo(n.createdAt)}</div>
                    </div>
                    {!n.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2.5 text-center">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-accent hover:underline"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
