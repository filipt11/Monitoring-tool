import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/auth";
import { defaultAuthenticatedPath } from "@/lib/routes";

export function AdminRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading session...</div>
      </div>
    );
  }

  if (!isAdmin(user)) {
    return <Navigate to={defaultAuthenticatedPath} replace />;
  }

  return <Outlet />;
}
