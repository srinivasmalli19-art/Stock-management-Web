import api from "./api";

export const userService = {
  getAll: (params) => api.get("/users", { params }),
  create: (data) => api.post("/users", data),
  update: (id, data) => api.put(`/users/${id}`, data),
  resetPassword: (id, data) => api.patch(`/users/${id}/password`, data),
  updateStatus: (id, data) => api.patch(`/users/${id}/status`, data),
};
