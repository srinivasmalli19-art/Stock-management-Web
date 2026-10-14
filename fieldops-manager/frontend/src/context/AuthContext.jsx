import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { completeSlcSignIn, endSlcSessionIfAny } from "../auth/slcSignIn";

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
    const res = await api.post("/auth/login", { email, password });
    console.log("LOGIN RESPONSE", res.data);

    const { accessToken, user } = res.data.data;

    localStorage.setItem("accessToken", accessToken);
    api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
    console.log("TOKEN SAVED", { role: user?.role, orgId: user?.orgId });

    // flushSync commits currentUser before navigate() fires so ProtectedRoute
    // never sees currentUser=null when it evaluates the destination route.
    flushSync(() => {
      setCurrentUser(user);
    });
    console.log("CURRENT USER SET", user?.role);

    const dest = ROLE_DEFAULT_ROUTES[user.role] || "/";
    console.log("NAVIGATING TO", dest);
    navigate(dest);
    return user;
  }, [navigate]);

  /** Store a session returned by the backend and go to the role's home page. */
  const startSession = useCallback((accessToken, user) => {
    localStorage.setItem("accessToken", accessToken);
    api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
    flushSync(() => {
      setCurrentUser(user);
    });
    navigate(ROLE_DEFAULT_ROUTES[user.role] || "/", { replace: true });
    return user;
  }, [navigate]);

  /** Finish "Sign in with SLC Account" (called by /sso/callback). */
  const completeSsoLogin = useCallback(async () => {
    const { accessToken, user } = await completeSlcSignIn();
    return startSession(accessToken, user);
  }, [startSession]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    localStorage.removeItem("accessToken");
    delete api.defaults.headers.common["Authorization"];
    setCurrentUser(null);
    // SLC sign-in sessions also end the shared SLC session (redirects away).
    if (await endSlcSessionIfAny()) return;
    navigate("/login");
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, logout, completeSsoLogin }}>
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
