import {
  ChevronDownIcon,
  DownloadIcon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SaveIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  exportHysteria2ConfigApi,
  getHysteria2ConfigApi,
  importHysteria2ConfigApi,
  listConfigApi,
  updateConfigsApi,
  updateHysteria2ConfigApi,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { assignWith, deepCopy } from "@/lib/format";
import { downloadResponse, validateFile } from "@/lib/io";
import {
  buildHysteriaPayload,
  defaultHysteria2ServerConfig,
  enabledSectionsFromConfig,
  HYSTERIA_CONFIG_KEYS,
  hysteriaSections,
  optionalSections,
  requiredSections,
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
  const [active, setActive] = useState<HysteriaSection>("extension");
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

  const [resetOpen, setResetOpen] = useState(false);

  const importInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

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
    [applyConfigValues, applyServerConfig]
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

  const visibleSections = hysteriaSections.filter(
    (section) => requiredSections.includes(section) || enabled[section]
  );
  const addableSections = optionalSections.filter((section) => !enabled[section]);

  const addSection = (section: HysteriaSection) => {
    setEnabled((prev) => ({ ...prev, [section]: true }));
    setActive(section);
  };

  const removeSection = (section: HysteriaSection) => {
    if (requiredSections.includes(section)) {
      toast.error(t("hysteria.requiredSection"));
      return;
    }
    setEnabled((prev) => ({ ...prev, [section]: false }));
    setActive("listen");
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

    if (next.listen) setActive("listen");
    else if (next["trafficStats.listen"]) setActive("http");
    else setActive("tls");
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
    setActive("extension");
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

  const running = Boolean(monitor?.running);

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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={addableSections.length === 0}
              >
                <PlusIcon data-icon="inline-start" />
                {t("hysteria.addConfigItem")}
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>{t("hysteria.addSection")}</DropdownMenuLabel>
              <DropdownMenuGroup>
                {addableSections.map((section) => (
                  <DropdownMenuItem
                    key={section}
                    onClick={() => addSection(section)}
                  >
                    {t(`hysteria.${section}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

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

      <Card>
        <CardHeader>
          <CardTitle>{t("hysteria.configuration")}</CardTitle>
          <CardDescription>{t("hysteria.description")}</CardDescription>
          <CardAction>
            <Badge variant="outline" className="font-mono text-[10px]">
              config.yaml
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState />
          ) : (
            <Tabs
              value={active}
              onValueChange={(value) => setActive(value as HysteriaSection)}
              className="gap-5"
            >
              <div className="-mx-1 overflow-x-auto px-1 pb-1">
                <TabsList variant="line" className="w-max min-w-full justify-start">
                  {visibleSections.map((section) => (
                    <TabsTrigger
                      key={section}
                      value={section}
                      className="flex-none gap-1 px-3"
                    >
                      {t(`hysteria.${section}`)}
                      {!requiredSections.includes(section) && (
                        <XIcon
                          aria-hidden
                          className="size-3 text-muted-foreground/70 transition-colors hover:text-foreground"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            removeSection(section);
                          }}
                        />
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {visibleSections.map((section) => (
                <TabsContent key={section} value={section}>
                  <div className="flex max-w-4xl flex-col gap-4">
                    {!requiredSections.includes(section) && (
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-medium">
                          {t(`hysteria.${section}`)}
                        </h2>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => removeSection(section)}
                        >
                          <XIcon data-icon="inline-start" />
                          {t("hysteria.removeSection")}
                        </Button>
                      </div>
                    )}
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
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

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
