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

export interface XrayServiceStatus {
  state: string;
  running: boolean;
  version: string;
}

export type XrayServiceAction = "start" | "stop" | "restart";
