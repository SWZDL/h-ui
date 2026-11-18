import { get, post } from "@/lib/api";

export interface VlessConfig {
  enabled: boolean;
  address: string;
  port: number;
  network: "tcp" | "ws" | "grpc";
  security: "none" | "tls" | "reality";
  remark: string;
  sni: string;
  fingerprint: string;
  publicKey: string;
  shortId: string;
  spiderX: string;
  flow: string;
  path: string;
  host: string;
  serviceName: string;
  alpn: string[];
  allowInsecure: boolean;
  xrayConfigPath: string;
  xrayServiceName: string;
  xrayApiAddress: string;
  xrayInboundTag: string;
  xrayBinaryPath: string;
}

export interface VlessSubscribeUrlDto {
  accountId: number;
  protocol: string;
  host: string;
}

export interface VlessUrlDto {
  accountId: number;
}

export interface VlessUrlVo {
  url: string;
  qrCode: string;
}

export function getVlessConfigApi() {
  return get<VlessConfig>("/vless/getVlessConfig");
}

export function updateVlessConfigApi(data: VlessConfig) {
  return post<null>("/vless/updateVlessConfig", data);
}

export function vlessSubscribeUrlApi(data: VlessSubscribeUrlDto) {
  return get<VlessUrlVo>("/vless/vlessSubscribeUrl", { ...data });
}

export function vlessUrlApi(data: VlessUrlDto) {
  return get<VlessUrlVo>("/vless/vlessUrl", { ...data });
}
