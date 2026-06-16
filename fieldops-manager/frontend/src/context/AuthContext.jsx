import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
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
      if (!token) {
        console.log("[Auth] fetchMe: no token, skipping");
        return;
      }
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      console.log("[Auth] fetchMe: calling /users/me");
      const res = await api.get("/users/me");
      console.log("[Auth] fetchMe: got user, role =", res.data.data?.role);
      setCurrentUser(res.data.data);
    } catch (err) {
      console.error("[Auth] fetchMe failed:", err?.response?.status, err?.message);
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
    console.log("[Auth] login: calling /auth/login");
    const res = await api.post("/auth/login", { email, password });
    const { accessToken, user } = res.data.data;
    console.log("[Auth] login: success, role =", user.role, "orgId =", user.orgId);
    localStorage.setItem("accessToken", accessToken);
    api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
    const dest = ROLE_DEFAULT_ROUTES[user.role] || "/";
    console.log("[Auth] login: navigating to", dest);
    // flushSync commits the state update before navigate() fires so ProtectedRoute
    // never sees currentUser=null when it renders the destination route.
    flushSync(() => {
      setCurrentUser(user);
    });
    navigate(dest);
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
