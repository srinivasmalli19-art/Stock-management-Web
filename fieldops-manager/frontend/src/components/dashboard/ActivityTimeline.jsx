import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import Card, { CardTitle } from "../common/Card";
import EmptyState from "../common/EmptyState";
import { timeAgo } from "../../utils/formatters";

const ACTION_MAP = {
  PRODUCTIVITY_SUBMITTED:    { label: "submitted a productivity log",  icon: "ti-file-plus",       color: "text-accent"   },
  PRODUCTIVITY_VALIDATED:    { label: "validated productivity",        icon: "ti-check",            color: "text-success"  },
  PRODUCTIVITY_REJECTED_TL:  { label: "rejected productivity (TL)",   icon: "ti-x",                color: "text-danger"   },
  PRODUCTIVITY_APPROVED:     { label: "approved productivity",        icon: "ti-circle-check",     color: "text-success"  },
  PRODUCTIVITY_REJECTED_ADMIN:{ label: "rejected productivity",       icon: "ti-x",                color: "text-danger"   },
  STOCK_REQUEST_CREATED:     { label: "submitted a stock request",    icon: "ti-package",          color: "text-accent"   },
  STOCK_REQUEST_APPROVED:    { label: "approved a stock request",     icon: "ti-check",            color: "text-success"  },
  STOCK_REQUEST_REJECTED:    { label: "rejected a stock request",     icon: "ti-x",                color: "text-danger"   },
  REVOKE_REQUEST_SUBMITTED:  { label: "initiated a stock revoke",     icon: "ti-refresh",          color: "text-warn"     },
  REVOKE_APPROVED:           { label: "approved a revoke request",    icon: "ti-check",            color: "text-success"  },
  REVOKE_REJECTED:           { label: "rejected a revoke request",    icon: "ti-x",                color: "text-danger"   },
  ATTENDANCE_SUBMITTED:      { label: "submitted attendance",         icon: "ti-calendar-event",   color: "text-accent"   },
  ATTENDANCE_APPROVED:       { label: "approved attendance",          icon: "ti-calendar-check",   color: "text-success"  },
  ATTENDANCE_REJECTED:       { label: "rejected attendance",          icon: "ti-calendar-x",       color: "text-danger"   },
  LP_REQUEST_CREATED:        { label: "created an LP request",        icon: "ti-receipt",          color: "text-purple"   },
  LP_APPROVED:               { label: "approved an LP request",       icon: "ti-circle-check",     color: "text-success"  },
  LP_REJECTED:               { label: "rejected an LP request",       icon: "ti-x",                color: "text-danger"   },
  CLAIM_CREATED:             { label: "submitted a claim",            icon: "ti-file-dollar",      color: "text-accent"   },
  CLAIM_VALIDATED:           { label: "validated a claim",            icon: "ti-check",            color: "text-success"  },
  CLAIM_ADMIN_APPROVED:      { label: "approved a claim",             icon: "ti-circle-check",     color: "text-success"  },
  CLAIM_ADMIN_REJECTED:      { label: "rejected a claim",             icon: "ti-x",                color: "text-danger"   },
  PURCHASE_INWARD_CREATED:   { label: "created a purchase inward",    icon: "ti-truck-delivery",   color: "text-accent"   },
  PURCHASE_INWARD_APPROVED:  { label: "approved purchase inward",     icon: "ti-check",            color: "text-success"  },
  PURCHASE_INWARD_REJECTED:  { label: "rejected purchase inward",     icon: "ti-x",                color: "text-danger"   },
  USER_CREATED:              { label: "created a user account",       icon: "ti-user-plus",        color: "text-accent"   },
  USER_UPDATED:              { label: "updated user details",         icon: "ti-user-edit",        color: "text-muted"    },
  USER_ACTIVATED:            { label: "activated a user",             icon: "ti-user-check",       color: "text-success"  },
  USER_DEACTIVATED:          { label: "deactivated a user",           icon: "ti-user-off",         color: "text-danger"   },
  USER_PASSWORD_RESET:       { label: "reset user password",          icon: "ti-lock-open",        color: "text-warn"     },
  PASSWORD_CHANGED:          { label: "changed their password",       icon: "ti-lock",             color: "text-warn"     },
  ORG_CREATED:               { label: "created an organisation",      icon: "ti-building-plus",    color: "text-purple"   },
  ORG_UPDATED:               { label: "updated an organisation",      icon: "ti-building",         color: "text-muted"    },
};

const formatRawAction = (action) =>
  action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function ActivityTimeline() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: () => api.get("/dashboard/activity").then((r) => r.data.data),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const items = data || [];

  return (
    <Card padding={false}>
      <div className="px-5 pt-4 pb-3 border-b border-border">
        <CardTitle>Recent Activity</CardTitle>
      </div>
      {isLoading ? (
        <div className="py-8 flex justify-center">
          <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="ti-history" message="No recent activity" sub="Activity will appear here as your team takes actions." />
      ) : (
        <div className="divide-y divide-border">
          {items.map((item, idx) => {
            const cfg = ACTION_MAP[item.action] || { label: formatRawAction(item.action), icon: "ti-activity", color: "text-muted" };
            return (
              <div key={item.id || idx} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <span className={`mt-0.5 shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center`}>
                  <i className={`ti ${cfg.icon} ${cfg.color} text-sm`} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text leading-snug">
                    <span className="font-semibold">{item.userName || "Someone"}</span>
                    {" "}
                    <span className="text-muted">{cfg.label}</span>
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">{timeAgo(item.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
