import {
  ActivityIcon,
  CpuIcon,
  GaugeIcon,
  HardDriveIcon,
  LaptopIcon,
  MemoryStickIcon,
  RefreshCwIcon,
  RocketIcon,
  UsersRoundIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { monitorHysteria2Api, monitorSystemApi } from "@/api/monitor";
import { StatCard, TinyBadge } from "@/components/common/stat-card";
import { LoadingState } from "@/components/common/states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import type { Hysteria2MonitorVo, SystemMonitorVo } from "@/types/api";

const REFRESH_INTERVAL = 10_000;

/** Percent values arrive as floats; trim the noise but keep one decimal. */
function formatPercent(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${Number(value.toFixed(1))}%`;
}

export function MonitorPage() {
  const { t } = useI18n();

  const [system, setSystem] = useState<SystemMonitorVo | null>(null);
  const [hysteria, setHysteria] = useState<Hysteria2MonitorVo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const [systemData, hysteriaData] = await Promise.all([
        monitorSystemApi(),
        monitorHysteria2Api(),
      ]);
      if (!mountedRef.current) return;
      setSystem(systemData);
      setHysteria(hysteriaData);
      setLastUpdated(Date.now());
    } catch {
      /* toast handled by the API layer */
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void load();
    }, REFRESH_INTERVAL);
    return () => window.clearInterval(timer);
  }, [autoRefresh, load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("monitor.title")}
        description={t("monitor.description")}
        actions={
          <>
            <div className="flex items-center gap-2">
              <Switch
                id="monitor-auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
              <Label
                htmlFor="monitor-auto-refresh"
                className="text-xs text-muted-foreground"
              >
                {t("monitor.autoRefresh")}
              </Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={refreshing}
              onClick={() => void handleRefresh()}
            >
              <RefreshCwIcon
                data-icon="inline-start"
                className={cn(refreshing && "animate-spin")}
              />
              {t("monitor.refreshNow")}
            </Button>
            {lastUpdated !== null && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {t("monitor.lastUpdated", {
                  time: new Date(lastUpdated).toLocaleTimeString(),
                })}
              </span>
            )}
          </>
        }
      />

      {loading ? (
        <LoadingState />
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">
                {t("monitor.system")}
              </h2>
              {autoRefresh && (
                <span
                  role="status"
                  aria-label={t("monitor.autoRefresh")}
                  className="size-2 shrink-0 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
                />
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label={t("monitor.huiVersion")}
                icon={CpuIcon}
                value={system?.huiVersion || "-"}
                badge={<TinyBadge>{t("app.version")}</TinyBadge>}
              />
              <StatCard
                label={t("monitor.cpuPercent")}
                icon={GaugeIcon}
                value={formatPercent(system?.cpuPercent)}
                progress={system?.cpuPercent}
              />
              <StatCard
                label={t("monitor.memPercent")}
                icon={MemoryStickIcon}
                value={formatPercent(system?.memPercent)}
                progress={system?.memPercent}
              />
              <StatCard
                label={t("monitor.diskPercent")}
                icon={HardDriveIcon}
                value={formatPercent(system?.diskPercent)}
                progress={system?.diskPercent}
              />
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold tracking-tight">
              {t("monitor.service")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label={t("monitor.hysteria2Version")}
                icon={RocketIcon}
                value={hysteria?.version || "-"}
              />
              <StatCard
                label={t("monitor.hysteria2Running")}
                icon={ActivityIcon}
                value={
                  hysteria === null ? (
                    "-"
                  ) : hysteria.running ? (
                    <Badge variant="secondary">
                      {t("monitor.hysteria2RunningTrue")}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      {t("monitor.hysteria2RunningFalse")}
                    </Badge>
                  )
                }
              />
              <StatCard
                label={t("monitor.hysteria2UserTotal")}
                icon={UsersRoundIcon}
                value={hysteria === null ? "-" : hysteria.userTotal}
              />
              <StatCard
                label={t("monitor.hysteria2DeviceTotal")}
                icon={LaptopIcon}
                value={hysteria === null ? "-" : hysteria.deviceTotal}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
