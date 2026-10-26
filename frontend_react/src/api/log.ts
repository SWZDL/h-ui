import { get, postRaw } from "@/lib/api";
import type {
  LogDto,
  LogExportDto,
  LogHysteria2Vo,
  LogSystemVo,
  PageVo,
} from "@/types/api";

export function logSystemApi(data: LogDto) {
  return get<PageVo<LogSystemVo>>("/log/logSystem", { ...data });
}

export function logHysteria2Api(data: LogDto) {
  return get<PageVo<LogHysteria2Vo>>("/log/logHysteria2", { ...data });
}

export function exportLogApi(data: LogExportDto) {
  return postRaw("/log/exportLog", data);
}
