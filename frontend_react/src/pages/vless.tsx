import {
  DownloadIcon,
  PlayIcon,
  RefreshCwIcon,
  RotateCwIcon,
  SquareIcon,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  controlXrayServiceApi,
  getVlessConfigApi,
  getXrayServiceStatusApi,
  listXrayReleaseVersionsApi,
  updateVlessConfigApi,
  upgradeXrayApi,
  type VlessConfig,
  type XrayServiceAction,
  type XrayServiceStatus,
} from "@/api/vless";
import { ConfigField } from "@/components/common/config-field";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

const DEFAULT_CONFIG: VlessConfig = {
  enabled: false,
  address: "",
  port: 443,
  network: "tcp",
  security: "tls",
  remark: "VLESS",
  sni: "",
  fingerprint: "chrome",
  publicKey: "",
  shortId: "",
  spiderX: "",
  flow: "",
  path: "/",
  host: "",
  serviceName: "",
  alpn: [],
  allowInsecure: false,
  xrayConfigPath: "/etc/xray/config.json",
  xrayServiceName: "xray",
  xrayApiAddress: "127.0.0.1:10085",
  xrayInboundTag: "h-ui-vless",
  xrayBinaryPath: "/usr/local/bin/xray",
};

export function VlessPage() {
  const { t } = useI18n();
  const [config, setConfig] = useState<VlessConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<XrayServiceStatus | null>(null);
  const [serviceLoading, setServiceLoading] = useState(false);
  // Stopping, restarting and upgrading affect every Xray user, so the risk is
  // carried by a confirmation instead of a paragraph nobody reads.
  const [pendingAction, setPendingAction] = useState<XrayServiceAction | null>(
    null
  );
  const [pendingUpgrade, setPendingUpgrade] = useState(false);
  const [serviceAction, setServiceAction] = useState<XrayServiceAction | null>(null);
  const [versions, setVersions] = useState<string[]>([]);
  const [version, setVersion] = useState("");
  const [upgrading, setUpgrading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConfig({ ...DEFAULT_CONFIG, ...(await getVlessConfigApi()) });
    } catch {
      /* API layer reports the error. */
    } finally {
      setLoading(false);
    }
  }, []);

  const loadServiceStatus = useCallback(async () => {
    setServiceLoading(true);
    try {
      setServiceStatus(await getXrayServiceStatusApi());
    } catch {
      setServiceStatus(null);
    } finally {
      setServiceLoading(false);
    }
  }, []);

  const loadVersions = useCallback(async () => {
    try {
      const available = await listXrayReleaseVersionsApi();
      setVersions(available);
      setVersion((current) => current || available[0] || "");
    } catch {
      setVersions([]);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadServiceStatus();
    void loadVersions();
    const timer = window.setInterval(() => void loadServiceStatus(), 15000);
    return () => window.clearInterval(timer);
  }, [load, loadServiceStatus, loadVersions]);

  const controlService = async (action: XrayServiceAction) => {
    if (serviceAction) return;
    setServiceAction(action);
    try {
      await controlXrayServiceApi(action);
      toast.success(t("vless.serviceActionSuccess"));
      await loadServiceStatus();
    } catch {
      /* API layer reports the error. */
    } finally {
      setServiceAction(null);
    }
  };

  const upgrade = async () => {
    if (!version || upgrading) return;
    setUpgrading(true);
    try {
      await upgradeXrayApi(version);
      toast.success(t("vless.upgradeSuccess"));
      await loadServiceStatus();
    } catch {
      /* API layer reports the error. */
    } finally {
      setUpgrading(false);
    }
  };

  const setField = <K extends keyof VlessConfig>(
    key: K,
    value: VlessConfig[K]
  ) => setConfig((prev) => ({ ...prev, [key]: value }));

  const setNetwork = (network: VlessConfig["network"]) => {
    setConfig((prev) => ({
      ...prev,
      network,
      security: network !== "tcp" && prev.security === "reality" ? "tls" : prev.security,
      flow: network !== "tcp" ? "" : prev.flow,
    }));
  };

  const setSecurity = (security: VlessConfig["security"]) => {
    setConfig((prev) => ({
      ...prev,
      security,
      network: security === "reality" ? "tcp" : prev.network,
      flow: security === "none" ? "" : prev.flow,
    }));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await updateVlessConfigApi({
        ...config,
        address: config.address.trim(),
        sni: config.sni.trim(),
        alpn: config.alpn.map((item) => item.trim()).filter(Boolean),
      });
      toast.success(t("vless.saveSuccess"));
    } catch {
      /* API layer reports the error. */
    } finally {
      setSaving(false);
    }
  };

  const setAlpn = (value: string) =>
    setField(
      "alpn",
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("vless.title")} description={t("vless.description")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("vless.serviceManagement")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={serviceStatus?.running ? "secondary" : "destructive"}
              className="gap-1.5 font-normal"
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  serviceStatus?.running ? "bg-chart-5" : "bg-destructive"
                )}
              />
              {serviceLoading
                ? t("common.loading")
                : serviceStatus?.running
                  ? t("monitor.running")
                  : t("monitor.stopped")}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">
              {serviceStatus?.version || "-"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadServiceStatus()}
              disabled={serviceLoading}
            >
              <RefreshCwIcon data-icon="inline-start" />
              {t("common.refresh")}
            </Button>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={Boolean(serviceAction) || serviceStatus?.running === true}
                onClick={() => void controlService("start")}
              >
                <PlayIcon data-icon="inline-start" />
                {t("vless.startService")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={Boolean(serviceAction) || serviceStatus?.running !== true}
                onClick={() => setPendingAction("stop")}
              >
                <SquareIcon data-icon="inline-start" />
                {t("vless.stopService")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={Boolean(serviceAction) || serviceStatus?.running !== true}
                onClick={() => setPendingAction("restart")}
              >
                <RotateCwIcon data-icon="inline-start" />
                {t("vless.restartService")}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <span className="text-sm font-medium">{t("vless.upgradeXray")}</span>
            <Select value={version} onValueChange={setVersion}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder={t("vless.selectVersion")} />
              </SelectTrigger>
              <SelectContent>
                {versions.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!version || upgrading || Boolean(serviceAction)}
              onClick={() => setPendingUpgrade(true)}
            >
              {upgrading ? <Spinner /> : <DownloadIcon data-icon="inline-start" />}
              {t("vless.upgrade")}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          {loading ? (
            <div className="flex min-h-40 items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <form className="flex flex-col gap-6" onSubmit={save}>
              <div className="flex items-center justify-between rounded-xl border p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t("vless.enabled")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("vless.enabledDescription")}
                  </p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(value) => setField("enabled", value)}
                  aria-label={t("vless.enabled")}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <ConfigField label={t("vless.address")} required>
                  <Input
                    value={config.address}
                    onChange={(event) => setField("address", event.target.value)}
                    placeholder="vless.example.com"
                  />
                </ConfigField>
                <ConfigField label={t("vless.port")} required>
                  <Input
                    type="number"
                    min={1}
                    max={65535}
                    value={config.port}
                    onChange={(event) => setField("port", Number(event.target.value))}
                  />
                </ConfigField>
                <ConfigField label={t("vless.remark")}>
                  <Input
                    value={config.remark}
                    onChange={(event) => setField("remark", event.target.value)}
                  />
                </ConfigField>
                <ConfigField label={t("vless.network")}>
                  <Select
                    value={config.network}
                    onValueChange={(value) =>
                      setNetwork(value as VlessConfig["network"])
                    }
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tcp">TCP</SelectItem>
                      <SelectItem value="ws">WebSocket</SelectItem>
                      <SelectItem value="grpc">gRPC</SelectItem>
                    </SelectContent>
                  </Select>
                </ConfigField>
                <ConfigField label={t("vless.security")}>
                  <Select
                    value={config.security}
                    onValueChange={(value) =>
                      setSecurity(value as VlessConfig["security"])
                    }
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="tls">TLS</SelectItem>
                      <SelectItem value="reality">Reality</SelectItem>
                    </SelectContent>
                  </Select>
                </ConfigField>
                {config.security !== "none" && (
                  <>
                    <ConfigField label={t("vless.sni")}>
                      <Input
                        value={config.sni}
                        onChange={(event) => setField("sni", event.target.value)}
                        placeholder={config.address || "example.com"}
                      />
                    </ConfigField>
                    <ConfigField label={t("vless.fingerprint")}>
                      <Input
                        value={config.fingerprint}
                        onChange={(event) => setField("fingerprint", event.target.value)}
                        placeholder="chrome"
                      />
                    </ConfigField>
                    <ConfigField label={t("vless.alpn")}>
                      <Input
                        value={config.alpn.join(",")}
                        onChange={(event) => setAlpn(event.target.value)}
                        placeholder="h2,http/1.1"
                      />
                    </ConfigField>
                  </>
                )}
                {config.security === "tls" && (
                  <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
                    <Switch
                      checked={config.allowInsecure}
                      onCheckedChange={(value) => setField("allowInsecure", value)}
                      aria-label={t("vless.allowInsecure")}
                    />
                    <span className="text-sm">{t("vless.allowInsecure")}</span>
                  </div>
                )}
                {config.security === "reality" && (
                  <>
                    <ConfigField label={t("vless.publicKey")} required>
                      <Input
                        value={config.publicKey}
                        onChange={(event) => setField("publicKey", event.target.value)}
                      />
                    </ConfigField>
                    <ConfigField label={t("vless.shortId")} required>
                      <Input
                        value={config.shortId}
                        onChange={(event) => setField("shortId", event.target.value)}
                      />
                    </ConfigField>
                    <ConfigField label={t("vless.spiderX")}>
                      <Input
                        value={config.spiderX}
                        onChange={(event) => setField("spiderX", event.target.value)}
                        placeholder="/"
                      />
                    </ConfigField>
                  </>
                )}
                {config.network === "tcp" && config.security !== "none" && (
                  <ConfigField label={t("vless.flow")}>
                  <Select
                    value={config.flow || "none"}
                    onValueChange={(value) => setField("flow", value === "none" ? "" : value)}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="xtls-rprx-vision">xtls-rprx-vision</SelectItem>
                    </SelectContent>
                  </Select>
                  </ConfigField>
                )}
                {config.network === "ws" && (
                  <>
                    <ConfigField label={t("vless.path")}>
                      <Input
                        value={config.path}
                        onChange={(event) => setField("path", event.target.value)}
                        placeholder="/"
                      />
                    </ConfigField>
                    <ConfigField label={t("vless.host")}>
                      <Input
                        value={config.host}
                        onChange={(event) => setField("host", event.target.value)}
                      />
                    </ConfigField>
                  </>
                )}
                {config.network === "grpc" && (
                  <ConfigField label={t("vless.serviceName")}>
                    <Input
                      value={config.serviceName}
                      onChange={(event) => setField("serviceName", event.target.value)}
                    />
                  </ConfigField>
                )}
              </div>

              <section className="space-y-4 rounded-xl border p-4">
                <div>
                  <h2 className="text-sm font-semibold">{t("vless.xrayManagement")}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("vless.xrayManagementDescription")}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <ConfigField label={t("vless.xrayConfigPath")} required>
                    <Input
                      value={config.xrayConfigPath}
                      onChange={(event) => setField("xrayConfigPath", event.target.value)}
                      placeholder="/etc/xray/config.json"
                    />
                  </ConfigField>
                  <ConfigField label={t("vless.xrayServiceName")} required>
                    <Input
                      value={config.xrayServiceName}
                      onChange={(event) => setField("xrayServiceName", event.target.value)}
                      placeholder="xray"
                    />
                  </ConfigField>
                  <ConfigField label={t("vless.xrayApiAddress")} required>
                    <Input
                      value={config.xrayApiAddress}
                      onChange={(event) => setField("xrayApiAddress", event.target.value)}
                      placeholder="127.0.0.1:10085"
                    />
                  </ConfigField>
                  <ConfigField label={t("vless.xrayInboundTag")} required>
                    <Input
                      value={config.xrayInboundTag}
                      onChange={(event) => setField("xrayInboundTag", event.target.value)}
                      placeholder="h-ui-vless"
                    />
                  </ConfigField>
                  <ConfigField label={t("vless.xrayBinaryPath")} required>
                    <Input
                      value={config.xrayBinaryPath}
                      onChange={(event) => setField("xrayBinaryPath", event.target.value)}
                      placeholder="/usr/local/bin/xray"
                    />
                  </ConfigField>
                </div>
              </section>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? <Spinner /> : null}
                  {t("common.save")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={pendingAction !== null || pendingUpgrade}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
            setPendingUpgrade(false);
          }
        }}
        title={t("vless.confirmImpactTitle")}
        description={t("vless.confirmImpactDescription")}
        confirmLabel={t("common.confirm")}
        destructive
        onConfirm={() => {
          const action = pendingAction;
          const upgradeNow = pendingUpgrade;
          setPendingAction(null);
          setPendingUpgrade(false);
          if (action) void controlService(action);
          else if (upgradeNow) void upgrade();
        }}
      />
    </div>
  );
}
