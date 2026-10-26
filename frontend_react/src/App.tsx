import type { ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAdmin, RequireAuth } from "@/components/auth-guards";
import { AppShell } from "@/components/layout/app-shell";
import { AccountsPage } from "@/pages/accounts";
import { DashboardPage } from "@/pages/dashboard";
import { HysteriaPage } from "@/pages/hysteria";
import { LoginPage } from "@/pages/login";
import { LogsPage } from "@/pages/logs";
import { MonitorPage } from "@/pages/monitor";
import { NotFoundPage } from "@/pages/not-found";
import { RedirectPage } from "@/pages/redirect";
import { SystemConfigPage } from "@/pages/system-config";
import { TelegramPage } from "@/pages/telegram";

function admin(element: ReactNode) {
  return <RequireAdmin>{element}</RequireAdmin>;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/redirect/*" element={<RedirectPage />} />

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
          <Route path="monitor/system" element={admin(<MonitorPage />)} />
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
