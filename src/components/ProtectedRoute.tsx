import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-pulse-glow rounded-full bg-gradient-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return children;
};