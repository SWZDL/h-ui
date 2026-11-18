import { useEffect, useState } from "react";
import { monitorSystemApi } from "@/api/monitor";
import type { SystemMonitorVo } from "@/types/api";

/** Service status is a slow signal; one shared snapshot per interval is enough. */
const REFRESH_INTERVAL = 30_000;

let snapshot: SystemMonitorVo | null = null;
let snapshotAt = 0;
let inFlight: Promise<SystemMonitorVo> | null = null;
const subscribers = new Set<(value: SystemMonitorVo) => void>();

function publish(value: SystemMonitorVo) {
  snapshot = value;
  snapshotAt = Date.now();
  subscribers.forEach((notify) => notify(value));
}

/**
 * Refreshes the host/service snapshot. Concurrent callers share one request so
 * the sidebar, the header and the account table never poll twice.
 */
export function refreshHostInfo(): Promise<SystemMonitorVo> {
  if (inFlight) return inFlight;
  inFlight = monitorSystemApi()
    .then((value) => {
      publish(value);
      return value;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Host name, IP and the proxy services that are currently running. The panel
 * uses this to label the header and to hide actions for stopped services.
 */
export function useHostInfo(): SystemMonitorVo | null {
  const [value, setValue] = useState<SystemMonitorVo | null>(snapshot);

  useEffect(() => {
    subscribers.add(setValue);
    const load = () => {
      void refreshHostInfo().catch(() => {
        /* the API layer already reports failures */
      });
    };
    if (!snapshot || Date.now() - snapshotAt > REFRESH_INTERVAL) load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_INTERVAL);
    return () => {
      subscribers.delete(setValue);
      window.clearInterval(timer);
    };
  }, []);

  return value;
}
