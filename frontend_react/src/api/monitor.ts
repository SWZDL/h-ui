import { get } from "@/lib/api";
import type { Hysteria2MonitorVo, SystemMonitorVo } from "@/types/api";

export function monitorSystemApi() {
  return get<SystemMonitorVo>("/monitor/monitorSystem");
}

export function monitorHysteria2Api() {
  return get<Hysteria2MonitorVo>("/monitor/monitorHysteria2");
}
