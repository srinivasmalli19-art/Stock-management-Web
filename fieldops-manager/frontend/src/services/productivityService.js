import api from "./api";

export const productivityService = {
  getLogs: (params) => api.get("/productivity", { params }),
  createLog: (data) => api.post("/productivity", data),
  validateLog: (id, data) => api.patch(`/productivity/${id}/validate`, data),
  rejectTL: (id, data) => api.patch(`/productivity/${id}/reject-tl`, data),
  approveLog: (id, data) => api.patch(`/productivity/${id}/approve`, data),
  rejectAdmin: (id, data) => api.patch(`/productivity/${id}/reject-admin`, data),
};
