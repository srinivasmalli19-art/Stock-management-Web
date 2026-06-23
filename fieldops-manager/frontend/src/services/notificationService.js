import api from "./api";

const notificationService = {
  getAll: (params) => api.get("/notifications", { params }).then((r) => r.data),
  getUnreadCount: () => api.get("/notifications/unread-count").then((r) => r.data.data.count),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch("/notifications/read-all"),
};

export default notificationService;
