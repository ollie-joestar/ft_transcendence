import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";

export default function ProfileRedirect() {
  const { user } = useAuth();
  if (!user) return null;
  return <Navigate to={`/u/${user.username}`} replace />;
}
