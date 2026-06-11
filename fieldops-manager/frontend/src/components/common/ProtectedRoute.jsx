import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { PageSpinner } from "./Spinner";

export default function ProtectedRoute() {
  const { currentUser, loading } = useAuth();

  if (loading) return <PageSpinner />;
  if (!currentUser) return <Navigate to="/login" replace />;

  return <Outlet />;
}
