import { get, post, postRaw } from "@/lib/api";
import type {
  ConfigDto,
  ConfigsDto,
  ConfigUpdateDto,
  ConfigVo,
  Hysteria2AcmePathVo,
  Hysteria2ServerConfig,
} from "@/types/api";

export function getHysteria2ConfigApi() {
  return get<Hysteria2ServerConfig>("/config/getHysteria2Config");
}

export function updateHysteria2ConfigApi(data: Hysteria2ServerConfig) {
  return post<null>("/config/updateHysteria2Config", data);
}

export function getConfigApi(data: ConfigDto) {
  return get<ConfigVo>("/config/getConfig", { key: data.key });
}

export function listConfigApi(data: ConfigsDto) {
  return post<ConfigVo[]>("/config/listConfig", data);
}

export function updateConfigsApi(data: ConfigUpdateDto) {
  return post<null>("/config/updateConfigs", data);
}

export function exportConfigApi() {
  return postRaw("/config/exportConfig");
}

export function importConfigApi(data: FormData) {
  return post<null>("/config/importConfig", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function exportHysteria2ConfigApi() {
  return postRaw("/config/exportHysteria2Config");
}

export function importHysteria2ConfigApi(data: FormData) {
  return post<null>("/config/importHysteria2Config", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function hysteria2AcmePathApi() {
  return get<Hysteria2AcmePathVo>("/config/hysteria2AcmePath");
}

export function restartServerApi() {
  return post<null>("/config/restartServer");
}

export function uploadCertFileApi(data: FormData) {
  return post<string>("/config/uploadCertFile", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}
