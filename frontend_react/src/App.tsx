import { Suspense, lazy, type ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAdmin, RequireAuth } from "@/components/auth-guards";
import { AppShell } from "@/components/layout/app-shell";
import { RouteFallback } from "@/components/route-fallback";
import { DashboardPage } from "@/pages/dashboard";
import { LoginPage } from "@/pages/login";

// The shell, the guards, the dashboard and the login screen are all part of a
// first paint for one of the two entry states, so they stay in the entry chunk.
// Everything behind a menu click is fetched the first time it is opened.
const AccountsPage = lazy(() =>
  import("@/pages/accounts").then((m) => ({ default: m.AccountsPage }))
);
const HysteriaPage = lazy(() =>
  import("@/pages/hysteria").then((m) => ({ default: m.HysteriaPage }))
);
const TelegramPage = lazy(() =>
  import("@/pages/telegram").then((m) => ({ default: m.TelegramPage }))
);
const SystemConfigPage = lazy(() =>
  import("@/pages/system-config").then((m) => ({ default: m.SystemConfigPage }))
);
const LogsPage = lazy(() =>
  import("@/pages/logs").then((m) => ({ default: m.LogsPage }))
);
const NotFoundPage = lazy(() =>
  import("@/pages/not-found").then((m) => ({ default: m.NotFoundPage }))
);
const RedirectPage = lazy(() =>
  import("@/pages/redirect").then((m) => ({ default: m.RedirectPage }))
);

function admin(element: ReactNode) {
  return <RequireAdmin>{element}</RequireAdmin>;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <Suspense fallback={<RouteFallback />}>
              <LoginPage />
            </Suspense>
          }
        />
        <Route
          path="/redirect/*"
          element={
            <Suspense fallback={<RouteFallback />}>
              <RedirectPage />
            </Suspense>
          }
        />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/info/account" replace />} />
          <Route path="info/account" element={<DashboardPage />} />
          <Route path="account/list" element={admin(<AccountsPage />)} />
          <Route path="hysteria/list" element={admin(<HysteriaPage />)} />
          <Route path="telegram/list" element={admin(<TelegramPage />)} />
          <Route path="config/list" element={admin(<SystemConfigPage />)} />
          {/* Monitoring lives on the overview page now; keep old bookmarks working. */}
          <Route path="monitor" element={<Navigate to="/info/account" replace />} />
          <Route
            path="monitor/system"
            element={<Navigate to="/info/account" replace />}
          />
          <Route path="log/system" element={admin(<LogsPage kind="system" />)} />
          <Route
            path="log/hysteria"
            element={admin(<LogsPage kind="hysteria" />)}
          />
          <Route path="404" element={<NotFoundPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
