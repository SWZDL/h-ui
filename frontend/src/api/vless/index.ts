import request from "@/utils/request";
import { AxiosPromise } from "axios";
import {
  VlessConfig,
  VlessSubscribeUrlDto,
  VlessUrlDto,
  VlessUrlVo,
  XrayServiceAction,
  XrayServiceStatus,
} from "./types";

export function getVlessConfigApi(): AxiosPromise<VlessConfig> {
  return request({ url: "/vless/getVlessConfig", method: "get" });
}

export function updateVlessConfigApi(data: VlessConfig): AxiosPromise {
  return request({ url: "/vless/updateVlessConfig", method: "post", data });
}

export function getXrayServiceStatusApi(): AxiosPromise<XrayServiceStatus> {
  return request({ url: "/vless/xray/status", method: "get" });
}

export function controlXrayServiceApi(action: XrayServiceAction): AxiosPromise {
  return request({ url: "/vless/xray/service", method: "post", data: { action } });
}

export function listXrayReleaseVersionsApi(): AxiosPromise<string[]> {
  return request({ url: "/vless/xray/releases", method: "get" });
}

export function upgradeXrayApi(version: string): AxiosPromise {
  return request({ url: "/vless/xray/upgrade", method: "post", data: { version } });
}

export function vlessSubscribeUrlApi(data: VlessSubscribeUrlDto): AxiosPromise<VlessUrlVo> {
  return request({ url: "/vless/vlessSubscribeUrl", method: "get", params: data });
}

export function vlessUrlApi(data: VlessUrlDto): AxiosPromise<VlessUrlVo> {
  return request({ url: "/vless/vlessUrl", method: "get", params: data });
}
