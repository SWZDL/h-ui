/* Server-side DTO / VO contracts, mirrored from the Go handlers. */

export interface IdDto {
  id: number;
}

export interface BaseDto {
  pageNum: number;
  pageSize: number;
  startTime?: string;
  endTime?: string;
}

export interface PageVo<T> {
  records: T[];
  total: number;
}

export interface ApiResult<T> {
  code: number;
  type: "ok" | "no";
  message: string;
  data: T;
}

/* ------------------------------------------------------------------ account */

export interface AccountLoginDto {
  username: string;
  pass: string;
}

export interface AccountLoginVo {
  accessToken: string;
  tokenType: string;
}

export interface AccountInfo {
  id: number;
  username: string;
  roles: string[];
}

export interface AccountPageDto extends BaseDto {
  username?: string;
  deleted?: number | string;
  remark?: string;
}

export interface AccountVo extends IdDto {
  username: string;
  quota: number;
  download: number;
  upload: number;
  expireTime: number;
  kickUtilTime: number;
  deviceNo: number;
  role: string;
  deleted: number;
  createTime: string;

  online: boolean;
  device: number;

  loginAt: number;
  conAt: number;
  remark: string;
}

export interface AccountSaveDto {
  username: string;
  pass: string;
  conPass: string;
  quota: number;
  expireTime: number;
  deviceNo: number;
  deleted: number;
  remark: string;
}

export interface AccountUpdateDto extends IdDto {
  username: string;
  pass: string;
  conPass: string;
  quota: number;
  expireTime: number;
  deviceNo: number;
  deleted: number;
  remark: string;
}

export interface AccountForm extends IdDto {
  username: string;
  pass: string;
  conPass: string;
  quota: number;
  expireTime: number;
  deviceNo: number;
  deleted: number;
  remark: string;
}

export interface KickAccountForm {
  ids: number[];
  kickUtilTime: number;
}

/* ------------------------------------------------------------------- config */

export interface ConfigDto {
  key: string;
}

export interface ConfigsDto {
  keys: string[];
}

export interface ConfigVo {
  key: string;
  value: string;
}

export interface ConfigsUpdateDto {
  key: string;
  value: string;
}

export interface ConfigUpdateDto {
  configUpdateDtos: ConfigsUpdateDto[];
}

export interface Hysteria2AcmePathVo {
  crtPath: string;
  keyPath: string;
}

export interface Hysteria2ServerConfigOutbound {
  name: string;
  type: string;
  socks5?: {
    addr: string;
    username?: string;
    password?: string;
  };
  http?: {
    url: string;
    insecure: boolean;
  };
  direct?: {
    mode: string;
    bindIPv4?: string;
    bindIPv6?: string;
    bindDevice?: string;
    fastOpen?: boolean;
  };
}

export interface Hysteria2ServerConfig {
  listen: string;
  tls?: {
    cert: string;
    key: string;
    sniGuard?: string;
  };
  acme?: {
    domains: string[];
    email: string;
    ca: string;
    listenHost: string;
    dir: string;
    type?: string;
    http?: {
      altPort: number;
    };
    tls?: {
      altPort: number;
    };
    dns?: {
      name: string;
      config: Record<string, string>;
    };
    disableHTTP: boolean;
    disableTLSALPN: boolean;
    altHTTPPort: number;
    altTLSALPNPort: number;
  };
  ech?: {
    keyPath: string;
  };
  obfs?: {
    type: string;
    salamander?: {
      password: string;
    };
    gecko?: {
      password: string;
      minPacketSize: number;
      maxPacketSize: number;
    };
  };
  quic?: {
    initStreamReceiveWindow?: number;
    maxStreamReceiveWindow?: number;
    initConnReceiveWindow?: number;
    maxConnReceiveWindow?: number;
    maxIdleTimeout?: string;
    maxIncomingStreams?: number;
    disablePathMTUDiscovery?: boolean;
  };
  bandwidth?: {
    up: string;
    down: string;
    disableLossCompensation: boolean;
  };
  ignoreClientBandwidth?: boolean;
  congestion?: {
    type: string;
    bbrProfile: string;
  };
  speedTest?: boolean;
  disableUDP?: boolean;
  udpIdleTimeout?: string;
  resolver?: {
    type: string;
    tcp?: {
      addr: string;
      timeout: string;
    };
    udp?: {
      addr: string;
      timeout: string;
    };
    tls?: {
      addr: string;
      timeout: string;
      sni: string;
      insecure: boolean;
    };
    https?: {
      addr: string;
      timeout: string;
      sni: string;
      insecure: boolean;
    };
  };
  sniff?: {
    enable: boolean;
    timeout: string;
    rewriteDomain: boolean;
    tcpPorts?: string;
    udpPorts?: string;
  };
  acl?: {
    file?: string;
    inline?: string[];
    geoip?: string;
    geosite?: string;
    geoUpdateInterval?: string;
  };
  outbounds?: Hysteria2ServerConfigOutbound[];
  trafficStats: {
    listen: string;
  };
  masquerade?: {
    type: string;
    file?: {
      dir: string;
    };
    proxy?: {
      url: string;
      rewriteHost: boolean;
      insecure: boolean;
      xForwarded: boolean;
    };
    string?: {
      content: string;
      headers?: Record<string, string>;
      statusCode?: number;
    };
    listenHTTP?: string;
    listenHTTPS?: string;
    forceHTTPS?: boolean;
  };
}

/* -------------------------------------------------------------------- log */

export interface LogDto {
  numLine: number;
}

export interface LogExportDto {
  option: number;
}

export interface LogSystemVo {
  clientIp: string;
  latencyTime: string;
  level: string;
  msg: string;
  reqMethod: string;
  reqUri: string;
  statusCode: string;
  time: string;
}

export interface LogHysteria2Vo {
  level: string;
  msg: string;
  time: string;
}

/* ----------------------------------------------------------------- monitor */

export interface SystemMonitorVo {
  huiVersion: string;
  cpuPercent: number;
  diskPercent: number;
  memPercent: number;
}

export interface Hysteria2MonitorVo {
  userTotal: number;
  deviceTotal: number;
  version: string;
  running: boolean;
}

/* --------------------------------------------------------------- hysteria2 */

export interface Hysteria2KickDto {
  ids: number[];
  kickUtilTime: number;
}

export interface Hysteria2VersionDto {
  version: string;
}

export interface Hysteria2SubscribeUrlDto {
  accountId: number;
  protocol: string;
  host: string;
}

export interface Hysteria2UrlDto {
  accountId: number;
  hostname: string;
}

export interface Hysteria2SubscribeVo {
  url: string;
  qrCode: string;
}

export interface Hysteria2UrlVo {
  url: string;
  qrCode: string;
}
