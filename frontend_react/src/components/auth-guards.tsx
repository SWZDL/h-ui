import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { LogoMark } from "@/components/logo";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth";

function Splash() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 bg-background">
      <LogoMark className="size-11" />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        <span>H UI</span>
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { token, user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <Splash />;

  if (!token || !user) {
    const redirect = `${location.pathname}${location.search}`;
    const search =
      redirect && redirect !== "/"
        ? `?redirect=${encodeURIComponent(redirect)}`
        : "";
    return <Navigate to={`/login${search}`} replace />;
  }

  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/404" replace />;
  }

  return <>{children}</>;
}
