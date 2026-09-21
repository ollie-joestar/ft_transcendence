import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
