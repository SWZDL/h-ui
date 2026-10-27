import {
  AlertTriangleIcon,
  DownloadIcon,
  FileCodeIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SaveIcon,
  UploadIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  exportHysteria2ConfigApi,
  getHysteria2ConfigApi,
  getHysteria2RawConfigApi,
  importHysteria2ConfigApi,
  listConfigApi,
  updateConfigsApi,
  updateHysteria2ConfigApi,
  updateHysteria2RawConfigApi,
  uploadCertFileApi,
} from "@/api/config";
import { hysteria2ChangeVersionApi, listReleaseApi } from "@/api/hysteria2";
import { monitorHysteria2Api } from "@/api/monitor";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { LoadingState } from "@/components/common/states";
import { SectionContent } from "@/components/hysteria/section-content";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { assignWith, deepCopy } from "@/lib/format";
import { downloadResponse, validateFile } from "@/lib/io";
import {
  applySectionDefaults,
  buildHysteriaPayload,
  defaultHysteria2ServerConfig,
  enabledSectionsFromConfig,
  HYSTERIA_CONFIG_KEYS,
  hysteriaSections,
  lockedSections,
  type AclType,
  type HysteriaSection,
  type SectionFlags,
  type TlsType,
} from "@/lib/hysteria";
import type {
  ConfigVo,
  Hysteria2MonitorVo,
  Hysteria2ServerConfig,
} from "@/types/api";

type UploadKind = "crt" | "key";

const emptySectionFlags = (): SectionFlags =>
  enabledSectionsFromConfig({} as Hysteria2ServerConfig);

export function HysteriaPage() {
  const { t } = useI18n();

  const [config, setConfig] = useState<Hysteria2ServerConfig>(() =>
    deepCopy(defaultHysteria2ServerConfig)
  );
  const [enabled, setEnabled] = useState<SectionFlags>(emptySectionFlags);
  const [tlsType, setTlsType] = useState<TlsType>("acme");
  const [aclType, setAclType] = useState<AclType>("inline");
  const [extension, setExtension] = useState({
    remark: "",
    portHopping: "",
    clashExtension: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<UploadKind | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [serviceEnabled, setServiceEnabled] = useState("0");
  const [versions, setVersions] = useState<string[]>([]);
  const [version, setVersion] = useState("");
  const [versionChanging, setVersionChanging] = useState(false);
  const [monitor, setMonitor] = useState<Hysteria2MonitorVo | null>(null);

  // Raw YAML editor state. The document is the file the Hysteria2 process
  // reads, so it is loaded alongside the form since the card is always visible.
  const [rawContent, setRawContent] = useState("");
  const [rawOriginal, setRawOriginal] = useState("");
  const [rawLoading, setRawLoading] = useState(false);
  const [rawSaving, setRawSaving] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);

  const importInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

  const sectionRefs = useRef<Partial<Record<HysteriaSection, HTMLDivElement>>>({});

  const applyConfigValues = useCallback((configs: ConfigVo[]) => {
    const values = new Map(configs.map((item) => [item.key, item.value]));
    setServiceEnabled(values.get(HYSTERIA_CONFIG_KEYS.enable) ?? "0");
    setExtension({
      remark: values.get(HYSTERIA_CONFIG_KEYS.remark) ?? "",
      portHopping: values.get(HYSTERIA_CONFIG_KEYS.portHopping) ?? "",
      clashExtension: values.get(HYSTERIA_CONFIG_KEYS.clashExtension) ?? "",
    });
  }, []);

  const applyServerConfig = useCallback((data: Hysteria2ServerConfig | null) => {
    if (!data) return;
    const draft = deepCopy(defaultHysteria2ServerConfig);
    assignWith(draft, data);
    setConfig(draft);
    setTlsType(data.tls?.cert && data.tls?.key ? "tls" : "acme");
    setAclType(data.acl?.inline ? "inline" : "file");
    setEnabled(enabledSectionsFromConfig(data));
  }, []);

  const loadRaw = useCallback(async () => {
    setRawLoading(true);
    try {
      const data = await getHysteria2RawConfigApi();
      const content = data?.content ?? "";
      setRawContent(content);
      setRawOriginal(content);
    } catch {
      /* toast handled by the API layer */
    } finally {
      setRawLoading(false);
    }
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);

      // The editor only depends on the configuration endpoints. Releases are
      // fetched from GitHub and must never block rendering the form.
      const [configsResult, serverResult] = await Promise.allSettled([
        listConfigApi({
          keys: [
            HYSTERIA_CONFIG_KEYS.enable,
            HYSTERIA_CONFIG_KEYS.remark,
            HYSTERIA_CONFIG_KEYS.portHopping,
            HYSTERIA_CONFIG_KEYS.clashExtension,
          ],
        }),
        getHysteria2ConfigApi(),
      ]);

      if (configsResult.status === "fulfilled") {
        applyConfigValues(configsResult.value ?? []);
      }
      if (serverResult.status === "fulfilled") {
        applyServerConfig(serverResult.value);
      }

      // The raw YAML card is always visible, so its content is part of the
      // initial render rather than an on-demand fetch.
      await loadRaw();
      setLoading(false);

      // Releases come from GitHub and the monitor shells out to the binary;
      // neither should keep the editor in a loading state.
      void Promise.allSettled([listReleaseApi(), monitorHysteria2Api()]).then(
        ([releasesResult, monitorResult]) => {
          if (releasesResult.status === "fulfilled") {
            setVersions((releasesResult.value ?? []).filter(Boolean));
          }
          if (monitorResult.status === "fulfilled") {
            setMonitor(monitorResult.value);
          }
        }
      );
    },
    [applyConfigValues, applyServerConfig, loadRaw]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (mutator: (draft: Hysteria2ServerConfig) => void) => {
    setConfig((prev) => {
      const draft = deepCopy(prev);
      mutator(draft);
      return draft;
    });
  };

  const toggleSection = (section: HysteriaSection, next: boolean) => {
    if (lockedSections.includes(section) && !next) {
      toast.error(t("hysteria.requiredSection"));
      return;
    }
    if (next) {
      setConfig((prev) => {
        const draft = deepCopy(prev);
        applySectionDefaults(draft, section);
        return draft;
      });
    }
    setEnabled((prev) => ({ ...prev, [section]: next }));
  };

  const handleEnableChange = async (next: boolean) => {
    const value = next ? "1" : "0";
    const previous = serviceEnabled;
    setServiceEnabled(value);
    try {
      await updateConfigsApi({
        configUpdateDtos: [{ key: HYSTERIA_CONFIG_KEYS.enable, value }],
      });
      toast.success(
        next ? t("common.enableSuccess") : t("common.disableSuccess")
      );
    } catch {
      setServiceEnabled(previous);
    }

    try {
      setMonitor(await monitorHysteria2Api());
    } catch {
      /* ignore */
    }
  };

  const handleChangeVersion = async () => {
    if (!version) {
      toast.error(t("hysteria.versionPlaceholder"));
      return;
    }
    setVersionChanging(true);
    toast.info(t("common.wait"));
    try {
      await hysteria2ChangeVersionApi({ version });
      toast.success(t("common.success"));
      setMonitor(await monitorHysteria2Api());
    } catch {
      /* handled globally */
    } finally {
      setVersionChanging(false);
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!config.listen.trim()) {
      next.listen = t("common.required");
    }
    if (!config.trafficStats.listen.trim()) {
      next["trafficStats.listen"] = t("common.required");
    }
    if (tlsType === "tls") {
      if (!config.tls?.cert.trim()) next["tls.cert"] = t("common.required");
      if (!config.tls?.key.trim()) next["tls.key"] = t("common.required");
    } else if (!config.acme?.domains.length) {
      next["acme.domains"] = t("common.required");
    }

    setErrors(next);
    if (Object.keys(next).length === 0) return true;

    const focus: HysteriaSection = next["trafficStats.listen"] ? "http" : "tls";
    sectionRefs.current[focus]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    if (next.listen) sectionRefs.current.listen?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    toast.error(t("common.operationFailed"));
    return false;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      await updateConfigsApi({
        configUpdateDtos: [
          { key: HYSTERIA_CONFIG_KEYS.remark, value: extension.remark },
          {
            key: HYSTERIA_CONFIG_KEYS.portHopping,
            value: extension.portHopping,
          },
          {
            key: HYSTERIA_CONFIG_KEYS.clashExtension,
            value: extension.clashExtension,
          },
        ],
      });
      await updateHysteria2ConfigApi(
        buildHysteriaPayload(config, enabled, tlsType, aclType)
      );
      toast.success(t("common.success"));
      await load(true);
      void loadRaw();
    } catch {
      /* handled globally */
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(deepCopy(defaultHysteria2ServerConfig));
    setEnabled(emptySectionFlags());
    setTlsType("acme");
    setAclType("inline");
    setExtension({ remark: "", portHopping: "", clashExtension: "" });
    setErrors({});
    toast.success(t("common.reset"));
  };

  const handleExport = async () => {
    try {
      const response = await exportHysteria2ConfigApi();
      downloadResponse(response, "hysteria2-config.yaml");
      toast.success(t("common.downloadStarted"));
    } catch {
      /* handled globally */
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateFile(file, {
      extensions: [".yaml", ".yml"],
      maxSizeMb: 2,
    });
    if (problem) {
      toast.error(problem);
      return;
    }

    const form = new FormData();
    form.append("file", file);
    try {
      await importHysteria2ConfigApi(form);
      toast.success(t("common.success"));
      await load(true);
      void loadRaw();
    } catch {
      /* handled globally */
    }
  };

  const handleUploadFile = async (kind: UploadKind, file: File | undefined) => {
    if (!file) return;
    const problem = validateFile(file, {
      extensions: [kind === "crt" ? ".crt" : ".key"],
      maxSizeMb: 1,
    });
    if (problem) {
      toast.error(problem);
      return;
    }

    setUploading(kind);
    const form = new FormData();
    form.append("file", file);
    try {
      const path = await uploadCertFileApi(form);
      patch((draft) => {
        draft.tls = draft.tls ?? { cert: "", key: "" };
        if (kind === "crt") draft.tls.cert = path;
        else draft.tls.key = path;
      });
      toast.success(t("common.success"));
    } catch {
      /* handled globally */
    } finally {
      setUploading(null);
    }
  };

  const handleSaveRaw = async () => {
    setRawSaving(true);
    try {
      await updateHysteria2RawConfigApi({ content: rawContent });
      setRawOriginal(rawContent);
      toast.success(t("hysteria.rawConfigSaved"));
      await load(true);
      setMonitor(await monitorHysteria2Api().catch(() => monitor));
    } catch {
      /* handled globally */
    } finally {
      setRawSaving(false);
    }
  };

  const running = Boolean(monitor?.running);
  const rawDirty = rawContent !== rawOriginal;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("hysteria.title")}
        description={t("hysteria.description")}
        actions={
          <>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Spinner /> : <SaveIcon data-icon="inline-start" />}
              {saving ? t("common.saving") : t("common.save")}
            </Button>
            <Button
              variant="outline"
              onClick={() => importInputRef.current?.click()}
            >
              <UploadIcon data-icon="inline-start" />
              {t("common.import")}
            </Button>
            <Button variant="outline" onClick={() => void handleExport()}>
              <DownloadIcon data-icon="inline-start" />
              {t("common.export")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setResetOpen(true)}
              className="text-muted-foreground"
            >
              <RotateCcwIcon data-icon="inline-start" />
              {t("common.reset")}
            </Button>
          </>
        }
      />

      <Card size="sm">
        <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={serviceEnabled === "1"}
              onCheckedChange={(checked) => void handleEnableChange(checked)}
            />
            <span>
              {serviceEnabled === "1" ? t("hysteria.enable") : t("hysteria.disable")}
            </span>
          </label>

          <Separator
            orientation="vertical"
            className="hidden data-[orientation=vertical]:h-6 sm:block"
          />

          <div className="flex items-center gap-2">
            <Select value={version} onValueChange={setVersion}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue placeholder={t("hysteria.versionPlaceholder")} />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  {versions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => void handleChangeVersion()}
              disabled={!version || versionChanging}
            >
              {versionChanging ? (
                <Spinner />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              {t("hysteria.hysteria2ChangeVersion")}
            </Button>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] font-normal">
              {t("hysteria.hysteria2Version")}: {monitor?.version || "-"}
            </Badge>
            <Badge
              variant={monitor ? (running ? "secondary" : "destructive") : "outline"}
              className="gap-1.5 text-[10px] font-normal"
            >
              <span
                className={
                  monitor
                    ? running
                      ? "size-1.5 rounded-full bg-primary"
                      : "size-1.5 rounded-full bg-destructive"
                    : "size-1.5 rounded-full bg-muted-foreground/40"
                }
              />
              {t("hysteria.hysteria2Running")}:{" "}
              {monitor
                ? running
                  ? t("monitor.hysteria2RunningTrue")
                  : t("monitor.hysteria2RunningFalse")
                : "-"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent>
            <LoadingState />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Panel-side metadata that never reaches the Hysteria2 YAML. */}
          <div ref={(node) => void (sectionRefs.current.extension = node ?? undefined)}>
            <Card>
              <CardHeader>
                <CardTitle>{t("hysteria.extension")}</CardTitle>
                <CardDescription>{t("hysteria.extensionHint")}</CardDescription>
                <CardAction>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {t("hysteria.panelOnly")}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <SectionContent
                  section="extension"
                  config={config}
                  patch={patch}
                  tlsType={tlsType}
                  onTlsTypeChange={setTlsType}
                  aclType={aclType}
                  onAclTypeChange={setAclType}
                  errors={errors}
                  uploading={uploading}
                  onUploadCert={(kind) => {
                    if (kind === "crt") certInputRef.current?.click();
                    else keyInputRef.current?.click();
                  }}
                  extension={extension}
                  onExtensionChange={(next) =>
                    setExtension((prev) => ({ ...prev, ...next }))
                  }
                />
              </CardContent>
            </Card>
          </div>

          {hysteriaSections
            .filter((section) => section !== "extension")
            .map((section) => {
              const locked = lockedSections.includes(section);
              const active = enabled[section] || locked;
              return (
                <div
                  key={section}
                  ref={(node) => void (sectionRefs.current[section] = node ?? undefined)}
                >
                  <Card className={active ? undefined : "opacity-70"}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {t(`hysteria.${section}`)}
                        {locked && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal"
                          >
                            {t("hysteria.required")}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {t(`hysteria.sectionHint.${section}`)}
                      </CardDescription>
                      <CardAction>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {active
                              ? t("hysteria.sectionOn")
                              : t("hysteria.sectionOff")}
                          </span>
                          <Switch
                            checked={active}
                            disabled={locked}
                            onCheckedChange={(checked) =>
                              toggleSection(section, checked)
                            }
                          />
                        </label>
                      </CardAction>
                    </CardHeader>
                    {active ? (
                      <CardContent>
                        <SectionContent
                          section={section}
                          config={config}
                          patch={patch}
                          tlsType={tlsType}
                          onTlsTypeChange={setTlsType}
                          aclType={aclType}
                          onAclTypeChange={setAclType}
                          errors={errors}
                          uploading={uploading}
                          onUploadCert={(kind) => {
                            if (kind === "crt") certInputRef.current?.click();
                            else keyInputRef.current?.click();
                          }}
                          extension={extension}
                          onExtensionChange={(next) =>
                            setExtension((prev) => ({ ...prev, ...next }))
                          }
                        />
                      </CardContent>
                    ) : (
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {t("hysteria.sectionDisabledHint")}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </div>
              );
            })}

          {/* The generated YAML, editable in place. */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCodeIcon className="size-4 text-muted-foreground" />
                {t("hysteria.rawConfig")}
              </CardTitle>
              <CardDescription>{t("hysteria.rawConfigDescription")}</CardDescription>
              <CardAction className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  bin/hysteria2.yaml
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void loadRaw()}
                  disabled={rawLoading}
                >
                  {rawLoading ? (
                    <Spinner />
                  ) : (
                    <RefreshCwIcon data-icon="inline-start" />
                  )}
                  {t("common.refresh")}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                <span>{t("hysteria.rawConfigHint")}</span>
              </div>

              {rawLoading ? (
                <div className="flex h-64 items-center justify-center rounded-lg border">
                  <Spinner />
                </div>
              ) : (
                <Textarea
                  value={rawContent}
                  spellCheck={false}
                  rows={22}
                  className="min-h-[22rem] resize-y font-mono text-xs leading-relaxed"
                  placeholder={t("hysteria.rawConfigEmpty")}
                  onChange={(event) => {
                    setRawContent(event.target.value);
                  }}
                />
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => void handleSaveRaw()}
                  disabled={rawSaving || rawLoading || !rawDirty}
                >
                  {rawSaving ? <Spinner /> : <SaveIcon data-icon="inline-start" />}
                  {rawSaving ? t("common.saving") : t("hysteria.rawConfigSave")}
                </Button>
                <Button
                  variant="outline"
                  disabled={!rawDirty || rawLoading}
                  onClick={() => setRawContent(rawOriginal)}
                >
                  <RotateCcwIcon data-icon="inline-start" />
                  {t("hysteria.rawConfigRevert")}
                </Button>
                {rawDirty && (
                  <span className="text-xs text-muted-foreground">
                    {t("hysteria.rawConfigDirty")}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hidden inputs: import + certificate uploads */}
      <input
        ref={importInputRef}
        type="file"
        accept=".yaml,.yml"
        className="hidden"
        onChange={(event) => {
          void handleImportFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={certInputRef}
        type="file"
        accept=".crt"
        className="hidden"
        onChange={(event) => {
          void handleUploadFile("crt", event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={keyInputRef}
        type="file"
        accept=".key"
        className="hidden"
        onChange={(event) => {
          void handleUploadFile("key", event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t("hysteria.resetTitle")}
        description={t("hysteria.resetDescription")}
        confirmLabel={t("common.reset")}
        destructive
        onConfirm={handleReset}
      />
    </div>
  );
}
