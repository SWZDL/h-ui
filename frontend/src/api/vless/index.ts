import request from "@/utils/request";
import { AxiosPromise } from "axios";
import { VlessConfig, VlessSubscribeUrlDto, VlessUrlDto, VlessUrlVo } from "./types";

export function getVlessConfigApi(): AxiosPromise<VlessConfig> {
  return request({ url: "/vless/getVlessConfig", method: "get" });
}

export function updateVlessConfigApi(data: VlessConfig): AxiosPromise {
  return request({ url: "/vless/updateVlessConfig", method: "post", data });
}

export function vlessSubscribeUrlApi(data: VlessSubscribeUrlDto): AxiosPromise<VlessUrlVo> {
  return request({ url: "/vless/vlessSubscribeUrl", method: "get", params: data });
}

export function vlessUrlApi(data: VlessUrlDto): AxiosPromise<VlessUrlVo> {
  return request({ url: "/vless/vlessUrl", method: "get", params: data });
}
