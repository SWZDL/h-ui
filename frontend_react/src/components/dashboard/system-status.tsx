import {
  CpuIcon,
  RefreshCwIcon,
  RocketIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { monitorHysteria2Api, monitorSystemApi } from "@/api/monitor";
import { TinyBadge } from "@/components/common/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import type { Hysteria2MonitorVo, SystemMonitorVo } from "@/types/api";

/** Monitoring is a slow signal; polling faster only adds server work. */
const REFRESH_INTERVAL = 15_000;

function clampPercent(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 100);
}

function formatPercent(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${Number(value.toFixed(1))}%`;
}

/** The bar itself carries the severity, so a single glance is enough. */
function meterTone(value?: number): string {
  const percent = clampPercent(value);
  if (percent >= 90) return "bg-destructive";
  if (percent >= 75) return "bg-chart-3";
  return "bg-primary";
}

interface MonitorSnapshot {
  system: SystemMonitorVo | null;
  hysteria: Hysteria2MonitorVo | null;
}

function useMonitor(refreshSignal: number) {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot>({
    system: null,
    hysteria: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const mounted = useRef(true);
  const inFlight = useRef(false);
  const seenSignal = useRef(refreshSignal);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [system, hysteria] = await Promise.all([
        monitorSystemApi(),
        monitorHysteria2Api(),
      ]);
      if (!mounted.current) return;
      setSnapshot({ system, hysteria });
      setLastUpdated(Date.now());
      setFailed(false);
    } catch {
      if (!mounted.current) return;
      // The API layer already surfaced a toast. Polling a failing endpoint
      // would toast once per tick, so pause and let the user retry.
      setFailed(true);
      setAutoRefresh(false);
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  // Only poll while the tab is visible; coming back refreshes immediately
  // instead of showing values that are up to one interval old.
  useEffect(() => {
    if (!autoRefresh) return;
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(refreshIfVisible, REFRESH_INTERVAL);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [autoRefresh, load]);

  // The page-level refresh button reloads the account and this panel together.
  useEffect(() => {
    if (refreshSignal === seenSignal.current) return;
    seenSignal.current = refreshSignal;
    void load();
  }, [refreshSignal, load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [load]);

  return {
    system: snapshot.system,
    hysteria: snapshot.hysteria,
    loading,
    refreshing,
    failed,
    autoRefresh,
    setAutoRefresh,
    lastUpdated,
    refresh,
  };
}

interface MeterProps {
  label: string;
  value?: number;
  loading: boolean;
}

function Meter({ label, value, loading }: MeterProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        {loading ? (
          <Skeleton className="h-4 w-10" />
        ) : (
          <span className="text-sm font-medium tabular-nums">
            {formatPercent(value)}
          </span>
        )}
      </div>
      <Progress
        value={loading ? 0 : clampPercent(value)}
        aria-label={label}
        className="h-1.5"
        indicatorClassName={meterTone(value)}
      />
    </div>
  );
}

function HostResourcesCard({
  system,
  loading,
}: {
  system: SystemMonitorVo | null;
  loading: boolean;
}) {
  const { t } = useI18n();

  const meters = [
    { key: "cpu", label: t("monitor.cpuPercent"), value: system?.cpuPercent },
    { key: "mem", label: t("monitor.memPercent"), value: system?.memPercent },
    {
      key: "disk",
      label: t("monitor.diskPercent"),
      value: system?.diskPercent,
    },
  ];

  return (
    <Card className="gap-4">
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <CpuIcon className="size-3.5" />
          </span>
          {t("monitor.system")}
        </CardTitle>
        <CardAction>
          {loading ? (
            <Skeleton className="h-5 w-16 rounded-full" />
          ) : (
            <TinyBadge>H UI {system?.huiVersion || "-"}</TinyBadge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        {meters.map((meter) => (
          <Meter
            key={meter.key}
            label={meter.label}
            value={meter.value}
            loading={loading}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function ServiceStat({
  label,
  value,
  loading,
  mono,
}: {
  label: string;
  value?: string | number;
  loading: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="text-[10px] leading-tight font-medium tracking-[0.1em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "truncate text-2xl font-medium tracking-tight",
          mono ? "font-mono" : "tabular-nums"
        )}
      >
        {loading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          (value ?? "-")
        )}
      </dd>
    </div>
  );
}

function ServiceCard({
  hysteria,
  loading,
}: {
  hysteria: Hysteria2MonitorVo | null;
  loading: boolean;
}) {
  const { t } = useI18n();
  const known = !loading && hysteria !== null;
  const running = Boolean(hysteria?.running);

  return (
    <Card className="gap-4">
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <RocketIcon className="size-3.5" />
          </span>
          {t("monitor.service")}
        </CardTitle>
        <CardAction>
          {known ? (
            <Badge
              variant={running ? "secondary" : "destructive"}
              className="gap-1.5 font-normal"
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  running
                    ? "animate-pulse bg-chart-5 motion-reduce:animate-none"
                    : "bg-destructive"
                )}
              />
              {running
                ? t("monitor.hysteria2RunningTrue")
                : t("monitor.hysteria2RunningFalse")}
            </Badge>
          ) : (
            <Skeleton className="h-5 w-16 rounded-full" />
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <dl className="grid grid-cols-3 gap-4">
          <ServiceStat
            label={t("dashboard.version")}
            value={hysteria?.version}
            loading={loading}
            mono
          />
          <ServiceStat
            label={t("dashboard.onlineUsers")}
            value={hysteria?.userTotal}
            loading={loading}
          />
          <ServiceStat
            label={t("dashboard.onlineDevices")}
            value={hysteria?.deviceTotal}
            loading={loading}
          />
        </dl>

        {known && !running ? (
          <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <ShieldAlertIcon className="mt-px size-3.5 shrink-0" />
            <span>{t("dashboard.serviceStopped")}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("dashboard.serviceRunning")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Host and service health, folded into the overview page. Both roles see the
 * same panel: an administrator checks capacity, an account checks whether the
 * service it connects to is up.
 */
export function SystemStatus({ refreshSignal = 0 }: { refreshSignal?: number }) {
  const { t } = useI18n();
  const monitor = useMonitor(refreshSignal);

  const updatedLabel =
    monitor.lastUpdated !== null
      ? t("monitor.lastUpdated", {
          // A 24-hour clock keeps the stamp identical in every locale; the
          // 12-hour form would leak AM/PM into the Chinese and Russian UI.
          time: new Date(monitor.lastUpdated).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
        })
      : null;

  return (
    <section
      aria-labelledby="system-status-title"
      className="mt-2 flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <h2
              id="system-status-title"
              className="font-serif text-lg leading-none tracking-tight"
            >
              {t("dashboard.systemStatus")}
            </h2>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  monitor.autoRefresh
                    ? "animate-pulse bg-chart-5 motion-reduce:animate-none"
                    : "bg-muted-foreground/45"
                )}
              />
              {monitor.autoRefresh ? t("dashboard.live") : t("dashboard.paused")}
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground">
            {t("dashboard.systemHint")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "text-[11px] tabular-nums",
              monitor.failed ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {monitor.failed
              ? t("dashboard.monitorUnavailable")
              : updatedLabel}
          </span>
          <div className="flex items-center gap-1.5">
            <Switch
              id="system-status-auto-refresh"
              size="sm"
              checked={monitor.autoRefresh}
              onCheckedChange={monitor.setAutoRefresh}
            />
            <Label
              htmlFor="system-status-auto-refresh"
              className="text-[11px] text-muted-foreground"
            >
              {t("monitor.autoRefresh")}
            </Label>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={monitor.refreshing}
            aria-label={t("monitor.refreshNow")}
            onClick={() => void monitor.refresh()}
          >
            <RefreshCwIcon
              className={cn(monitor.refreshing && "animate-spin")}
            />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <HostResourcesCard system={monitor.system} loading={monitor.loading} />
        <ServiceCard hysteria={monitor.hysteria} loading={monitor.loading} />
      </div>
    </section>
  );
}
