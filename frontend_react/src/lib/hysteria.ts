import type {
  Hysteria2ServerConfig,
  Hysteria2ServerConfigOutbound,
} from "@/types/api";
import { deepCopy } from "@/lib/format";

export const defaultHysteria2ServerConfig: Hysteria2ServerConfig = {
  listen: ":443",
  tls: {
    cert: "",
    key: "",
    sniGuard: "",
  },
  acme: {
    domains: [],
    email: "",
    ca: "zerossl",
    listenHost: "0.0.0.0",
    dir: "my_acme_dir",
    type: "",
    http: {
      altPort: 8888,
    },
    tls: {
      altPort: 44333,
    },
    dns: {
      name: "gomommy",
      config: {},
    },
    disableHTTP: false,
    disableTLSALPN: false,
    altHTTPPort: 80,
    altTLSALPNPort: 443,
  },
  ech: {
    keyPath: "ech.pem",
  },
  obfs: {
    type: "salamander",
    salamander: {
      password: "cry_me_a_r1ver",
    },
    gecko: {
      password: "cry_me_a_r1ver",
      minPacketSize: 512,
      maxPacketSize: 1200,
    },
  },
  quic: {
    initStreamReceiveWindow: 8388608,
    maxStreamReceiveWindow: 8388608,
    initConnReceiveWindow: 20971520,
    maxConnReceiveWindow: 20971520,
    maxIdleTimeout: "30s",
    maxIncomingStreams: 1024,
    disablePathMTUDiscovery: false,
  },
  bandwidth: {
    up: "1 gbps",
    down: "1 gbps",
    disableLossCompensation: false,
  },
  ignoreClientBandwidth: false,
  congestion: {
    type: "bbr",
    bbrProfile: "standard",
  },
  speedTest: false,
  disableUDP: false,
  udpIdleTimeout: "60s",
  resolver: {
    type: "",
    tcp: {
      addr: "8.8.8.8:53",
      timeout: "4s",
    },
    udp: {
      addr: "8.8.4.4:53",
      timeout: "4s",
    },
    tls: {
      addr: "1.1.1.1:853",
      timeout: "10s",
      sni: "cloudflare-dns.com",
      insecure: false,
    },
    https: {
      addr: "1.1.1.1:443",
      timeout: "10s",
      sni: "cloudflare-dns.com",
      insecure: false,
    },
  },
  sniff: {
    enable: true,
    timeout: "2s",
    rewriteDomain: false,
    tcpPorts: "80,443,8000-9000",
    udpPorts: "all",
  },
  acl: {
    file: "",
    inline: [],
    geoip: "",
    geosite: "",
    geoUpdateInterval: "168h",
  },
  outbounds: [],
  trafficStats: {
    listen: ":9999",
  },
  masquerade: {
    type: "",
    file: {
      dir: "",
    },
    proxy: {
      url: "",
      rewriteHost: true,
      insecure: false,
      xForwarded: false,
    },
    string: {
      content: "hello stupid world",
      headers: {},
      statusCode: 200,
    },
    listenHTTP: ":80",
    listenHTTPS: ":443",
    forceHTTPS: true,
  },
};

export const defaultHysteria2ServerConfigOutbound: Hysteria2ServerConfigOutbound =
  {
    name: "",
    type: "socks5",
    socks5: {
      addr: "",
      username: undefined,
      password: undefined,
    },
    http: {
      url: "",
      insecure: false,
    },
    direct: {
      mode: "auto",
      bindIPv4: undefined,
      bindIPv6: undefined,
      bindDevice: undefined,
      fastOpen: false,
    },
  };

export const hysteriaSections = [
  "extension",
  "listen",
  "tls",
  "ech",
  "obfs",
  "quic",
  "bandwidth",
  "speedTest",
  "udp",
  "resolver",
  "sniff",
  "acl",
  "outbounds",
  "http",
  "masquerade",
] as const;

export type HysteriaSection = (typeof hysteriaSections)[number];

export const requiredSections: HysteriaSection[] = [
  "extension",
  "listen",
  "tls",
  "http",
];

/** Optional sections that can be added / removed from the editor. */
export const optionalSections: HysteriaSection[] = [
  "ech",
  "obfs",
  "quic",
  "bandwidth",
  "speedTest",
  "udp",
  "resolver",
  "sniff",
  "acl",
  "outbounds",
  "masquerade",
];

export type SectionFlags = Record<HysteriaSection, boolean>;
export type TlsType = "tls" | "acme";
export type AclType = "file" | "inline";

export function enabledSectionsFromConfig(
  config: Hysteria2ServerConfig
): SectionFlags {
  return {
    extension: true,
    listen: true,
    tls: true,
    http: true,
    ech: Boolean(config.ech),
    obfs: Boolean(config.obfs),
    quic: Boolean(config.quic),
    bandwidth: Boolean(config.bandwidth),
    speedTest: Boolean(config.speedTest),
    udp: Boolean(config.disableUDP) || Boolean(config.udpIdleTimeout),
    resolver: Boolean(config.resolver),
    sniff: Boolean(config.sniff),
    acl: Boolean(config.acl),
    outbounds: Array.isArray(config.outbounds) && config.outbounds.length > 0,
    masquerade: Boolean(config.masquerade),
  };
}

/**
 * Produce a clean payload: drop variants that do not match the selected type
 * and remove any section the operator disabled.
 */
export function buildHysteriaPayload(
  draft: Hysteria2ServerConfig,
  enabled: SectionFlags,
  tlsType: TlsType,
  aclType: AclType
): Hysteria2ServerConfig {
  const config = deepCopy(draft);

  if (config.obfs) {
    if (config.obfs.type === "salamander") {
      config.obfs.gecko = undefined;
    } else if (config.obfs.type === "gecko") {
      config.obfs.salamander = undefined;
    }
  }

  if (tlsType === "tls") {
    config.acme = undefined;
  } else if (tlsType === "acme") {
    config.tls = undefined;
    const acme = config.acme;
    if (acme) {
      if (acme.type === "http") {
        acme.tls = undefined;
        acme.dns = undefined;
      } else if (acme.type === "tls") {
        acme.http = undefined;
        acme.dns = undefined;
      } else if (acme.type === "dns") {
        acme.http = undefined;
        acme.tls = undefined;
      } else {
        acme.http = undefined;
        acme.tls = undefined;
        acme.dns = undefined;
      }
    }
  }

  if (config.acl) {
    if (aclType === "inline") {
      config.acl.file = undefined;
    } else {
      config.acl.inline = undefined;
    }
  }

  if (config.resolver) {
    const type = config.resolver.type;
    if (type === "tcp") {
      config.resolver.udp = undefined;
      config.resolver.tls = undefined;
      config.resolver.https = undefined;
    } else if (type === "udp") {
      config.resolver.tcp = undefined;
      config.resolver.tls = undefined;
      config.resolver.https = undefined;
    } else if (type === "tls") {
      config.resolver.tcp = undefined;
      config.resolver.udp = undefined;
      config.resolver.https = undefined;
    } else if (type === "https") {
      config.resolver.tcp = undefined;
      config.resolver.udp = undefined;
      config.resolver.tls = undefined;
    }
  }

  if (config.masquerade) {
    if (config.masquerade.type === "file") {
      config.masquerade.proxy = undefined;
      config.masquerade.string = undefined;
    } else if (config.masquerade.type === "proxy") {
      config.masquerade.file = undefined;
      config.masquerade.string = undefined;
    } else if (config.masquerade.type === "string") {
      config.masquerade.file = undefined;
      config.masquerade.proxy = undefined;
    }
  }

  if (!enabled.ech) config.ech = undefined;
  if (!enabled.obfs) config.obfs = undefined;
  if (!enabled.quic) config.quic = undefined;
  if (!enabled.bandwidth) {
    config.bandwidth = undefined;
    config.ignoreClientBandwidth = undefined;
    config.congestion = undefined;
  }
  if (!enabled.speedTest) config.speedTest = undefined;
  if (!enabled.udp) {
    config.disableUDP = undefined;
    config.udpIdleTimeout = undefined;
  }
  if (!enabled.resolver) config.resolver = undefined;
  if (!enabled.sniff) config.sniff = undefined;
  if (!enabled.acl) config.acl = undefined;
  if (!enabled.outbounds) config.outbounds = undefined;
  if (!enabled.masquerade) config.masquerade = undefined;

  // Empty duration strings are invalid for Hysteria; fall back to defaults.
  if (config.udpIdleTimeout === "") config.udpIdleTimeout = "60s";
  if (config.quic?.maxIdleTimeout === "") config.quic.maxIdleTimeout = "30s";
  if (config.resolver?.tcp?.timeout === "") config.resolver.tcp.timeout = "4s";
  if (config.resolver?.udp?.timeout === "") config.resolver.udp.timeout = "4s";
  if (config.resolver?.tls?.timeout === "") config.resolver.tls.timeout = "10s";
  if (config.resolver?.https?.timeout === "") {
    config.resolver.https.timeout = "10s";
  }
  if (config.sniff?.timeout === "") config.sniff.timeout = "2s";
  if (config.acl?.geoUpdateInterval === "") {
    config.acl.geoUpdateInterval = "168h";
  }

  return config;
}

/** Config keys persisted outside of the Hysteria YAML. */
export const HYSTERIA_CONFIG_KEYS = {
  enable: "HYSTERIA2_ENABLE",
  remark: "HYSTERIA2_CONFIG_REMARK",
  portHopping: "HYSTERIA2_CONFIG_PORT_HOPPING",
  clashExtension: "CLASH_EXTENSION",
} as const;

export const PANEL_CONFIG_KEYS = {
  webPort: "H_UI_WEB_PORT",
  webContext: "H_UI_WEB_CONTEXT",
  trafficTime: "HYSTERIA2_TRAFFIC_TIME",
  crtPath: "H_UI_CRT_PATH",
  keyPath: "H_UI_KEY_PATH",
  resetTrafficCron: "RESET_TRAFFIC_CRON",
} as const;

export const TELEGRAM_CONFIG_KEYS = {
  enable: "TELEGRAM_ENABLE",
  token: "TELEGRAM_TOKEN",
  chatId: "TELEGRAM_CHAT_ID",
  loginJobEnable: "TELEGRAM_LOGIN_JOB_ENABLE",
  loginJobText: "TELEGRAM_LOGIN_JOB_TEXT",
} as const;
