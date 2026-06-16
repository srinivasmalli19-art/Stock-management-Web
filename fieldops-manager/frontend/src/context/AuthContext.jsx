import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const AuthContext = createContext(null);

const ROLE_DEFAULT_ROUTES = {
  Super_Admin: "/superadmin/dashboard",
  Admin: "/admin/approvals",
  Store_Manager: "/store/dashboard",
  Team_Leader: "/tl/approvals",
  Engineer: "/engineer/dashboard",
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchMe = useCallback(async () => {
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) return;
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      const res = await api.get("/users/me");
      setCurrentUser(res.data.data);
    } catch {
      setCurrentUser(null);
      localStorage.removeItem("accessToken");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe().finally(() => setLoading(false));
  }, [fetchMe]);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    const { accessToken, user } = res.data.data;
    localStorage.setItem("accessToken", accessToken);
    api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
    setCurrentUser(user);
    navigate(ROLE_DEFAULT_ROUTES[user.role] || "/");
    return user;
  }, [navigate]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    localStorage.removeItem("accessToken");
    delete api.defaults.headers.common["Authorization"];
    setCurrentUser(null);
    navigate("/login");
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export default AuthContext;
