import {
  DownloadIcon,
  RotateCwIcon,
  SaveIcon,
  ShieldCheckIcon,
  UploadIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  exportConfigApi,
  hysteria2AcmePathApi,
  importConfigApi,
  listConfigApi,
  restartServerApi,
  updateConfigsApi,
  uploadCertFileApi,
} from "@/api/config";
import { ConfigField } from "@/components/common/config-field";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { LoadingState } from "@/components/common/states";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { PANEL_CONFIG_KEYS } from "@/lib/hysteria";
import { downloadResponse, validateFile } from "@/lib/io";
import { cn } from "@/lib/utils";

interface SystemConfigForm {
  huiWebPort: string;
  huiWebContext: string;
  hysteria2TrafficTime: string;
  huiCrtPath: string;
  huiKeyPath: string;
  resetTrafficCron: string;
}

type SystemConfigField = Exclude<keyof SystemConfigForm, "resetTrafficCron">;
type SystemConfigErrors = Partial<Record<SystemConfigField, string>>;

const EMPTY_FORM: SystemConfigForm = {
  huiWebPort: "",
  huiWebContext: "",
  hysteria2TrafficTime: "",
  huiCrtPath: "",
  huiKeyPath: "",
  resetTrafficCron: "",
};

const CONFIG_KEYS: string[] = [
  PANEL_CONFIG_KEYS.webPort,
  PANEL_CONFIG_KEYS.webContext,
  PANEL_CONFIG_KEYS.trafficTime,
  PANEL_CONFIG_KEYS.crtPath,
  PANEL_CONFIG_KEYS.keyPath,
  PANEL_CONFIG_KEYS.resetTrafficCron,
];

const CRON_PRESETS = [
  { value: "@monthly", labelKey: "config.resetTrafficMonth" },
  { value: "@weekly", labelKey: "config.resetTrafficWeek" },
] as const;

const PORT_PATTERN = /^\d+$/;
const CONTEXT_PATTERN = /^\/([a-z0-9]+(\/[a-z0-9]+)*)?$/;
const TRAFFIC_TIME_PATTERN = /^\d+(\.\d)?$/;

function isErrorField(
  field: keyof SystemConfigForm
): field is SystemConfigField {
  return field !== "resetTrafficCron";
}

export function SystemConfigPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const focus = searchParams.get("focus");

  const [form, setForm] = useState<SystemConfigForm>(EMPTY_FORM);
  const [https, setHttps] = useState(false);
  const [errors, setErrors] = useState<SystemConfigErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState<"crt" | "key" | null>(null);
  const [applyingCert, setApplyingCert] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [highlightHttps, setHighlightHttps] = useState(false);

  const importInputRef = useRef<HTMLInputElement>(null);
  const crtInputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const httpsSectionRef = useRef<HTMLElement>(null);

  const setField = <K extends keyof SystemConfigForm>(
    field: K,
    value: SystemConfigForm[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));

    if (isErrorField(field)) {
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = (await listConfigApi({ keys: CONFIG_KEYS })) ?? [];
      const values = new Map<string, string>();
      for (const item of data) {
        values.set(item.key, item.value ?? "");
      }

      const crtPath = values.get(PANEL_CONFIG_KEYS.crtPath) ?? "";
      const keyPath = values.get(PANEL_CONFIG_KEYS.keyPath) ?? "";

      setForm({
        huiWebPort: values.get(PANEL_CONFIG_KEYS.webPort) ?? "",
        huiWebContext: values.get(PANEL_CONFIG_KEYS.webContext) ?? "",
        hysteria2TrafficTime: values.get(PANEL_CONFIG_KEYS.trafficTime) ?? "",
        huiCrtPath: crtPath,
        huiKeyPath: keyPath,
        resetTrafficCron: values.get(PANEL_CONFIG_KEYS.resetTrafficCron) ?? "",
      });
      setHttps(Boolean(crtPath) && Boolean(keyPath));
      setErrors({});
    } catch {
      /* the API layer already surfaced the error as a toast */
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Deep link from the dashboard security alert: /config/list?focus=huiHttps
  useEffect(() => {
    if (focus !== "huiHttps" || loading) return;
    setHighlightHttps(true);

    const frame = window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      httpsSectionRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
    });
    const timer = window.setTimeout(() => setHighlightHttps(false), 2600);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [focus, loading]);

  const validate = (): SystemConfigErrors => {
    const next: SystemConfigErrors = {};

    const port = form.huiWebPort.trim();
    if (!port) next.huiWebPort = t("common.required");
    else if (!PORT_PATTERN.test(port)) next.huiWebPort = t("config.portInvalid");

    const context = form.huiWebContext.trim();
    if (!context) next.huiWebContext = t("common.required");
    else if (!CONTEXT_PATTERN.test(context)) {
      next.huiWebContext = t("config.contextInvalid");
    }

    const trafficTime = form.hysteria2TrafficTime.trim();
    if (!trafficTime) next.hysteria2TrafficTime = t("common.required");
    else if (!TRAFFIC_TIME_PATTERN.test(trafficTime)) {
      next.hysteria2TrafficTime = t("config.trafficTimeInvalid");
    }

    if (https) {
      if (!form.huiCrtPath.trim()) next.huiCrtPath = t("common.required");
      if (!form.huiKeyPath.trim()) next.huiKeyPath = t("common.required");
    }

    return next;
  };

  const save = async () => {
    if (saving) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await updateConfigsApi({
        configUpdateDtos: [
          { key: PANEL_CONFIG_KEYS.webPort, value: form.huiWebPort.trim() },
          {
            key: PANEL_CONFIG_KEYS.webContext,
            value: form.huiWebContext.trim(),
          },
          {
            key: PANEL_CONFIG_KEYS.trafficTime,
            value: form.hysteria2TrafficTime.trim(),
          },
          {
            key: PANEL_CONFIG_KEYS.crtPath,
            value: https ? form.huiCrtPath.trim() : "",
          },
          {
            key: PANEL_CONFIG_KEYS.keyPath,
            value: https ? form.huiKeyPath.trim() : "",
          },
          {
            key: PANEL_CONFIG_KEYS.resetTrafficCron,
            value: form.resetTrafficCron.trim(),
          },
        ],
      });
      toast.success(t("common.success"));
      await load(true);
    } catch {
      /* the API layer already surfaced the error as a toast */
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save();
  };

  const applyHysteria2Cert = async () => {
    setApplyingCert(true);
    try {
      const data = await hysteria2AcmePathApi();
      setField("huiCrtPath", data.crtPath ?? "");
      setField("huiKeyPath", data.keyPath ?? "");
    } catch {
      /* the API layer already surfaced the error as a toast */
    } finally {
      setApplyingCert(false);
    }
  };

  const uploadCertificate = async (file: File, kind: "crt" | "key") => {
    const extension = kind === "crt" ? ".crt" : ".key";
    const problem = validateFile(file, {
      extensions: [extension],
      maxSizeMb: 1,
    });
    if (problem) {
      toast.error(problem);
      return;
    }

    const data = new FormData();
    data.append("file", file);

    setUploading(kind);
    try {
      const path = await uploadCertFileApi(data);
      setField(kind === "crt" ? "huiCrtPath" : "huiKeyPath", path);
      toast.success(t("common.success"));
    } catch {
      /* the API layer already surfaced the error as a toast */
    } finally {
      setUploading(null);
    }
  };

  const handleCertFileChange =
    (kind: "crt" | "key") => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) void uploadCertificate(file, kind);
    };

  const handleImportChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const problem = validateFile(file, {
      extensions: [".json"],
      maxSizeMb: 2,
    });
    if (problem) {
      toast.error(problem);
      return;
    }

    const data = new FormData();
    data.append("file", file);
    setImporting(true);
    try {
      await importConfigApi(data);
      await load(true);
      toast.success(t("common.success"));
    } catch {
      /* the API layer already surfaced the error as a toast */
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await exportConfigApi();
      downloadResponse(response, t("config.exportFile"));
      toast.success(t("common.downloadStarted"));
    } catch {
      /* the API layer already surfaced the error as a toast */
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("config.title")}
        description={t("config.description")}
        actions={
          <>
            <Button
              size="sm"
              type="submit"
              form="system-config-form"
              disabled={saving || loading}
            >
              {saving ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SaveIcon data-icon="inline-start" />
              )}
              {t("common.save")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRestartOpen(true)}
            >
              <RotateCwIcon data-icon="inline-start" />
              {t("config.restartServer")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => importInputRef.current?.click()}
              disabled={importing || loading}
            >
              {importing ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <UploadIcon data-icon="inline-start" />
              )}
              {t("common.import")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleExport()}
              disabled={exporting}
            >
              {exporting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <DownloadIcon data-icon="inline-start" />
              )}
              {t("common.export")}
            </Button>
          </>
        }
      />

      <Card className="max-w-3xl">
        <CardContent>
          {loading ? (
            <LoadingState />
          ) : (
            <form
              id="system-config-form"
              className="flex flex-col gap-6"
              noValidate
              aria-busy={saving}
              onSubmit={handleSubmit}
            >
              <FieldGroup>
                <ConfigField
                  label={t("config.huiWebPort")}
                  hint={t("config.portHint")}
                  htmlFor="hui-web-port"
                  required
                  error={errors.huiWebPort}
                >
                  <Input
                    id="hui-web-port"
                    name="huiWebPort"
                    inputMode="numeric"
                    autoComplete="off"
                    className="font-mono"
                    value={form.huiWebPort}
                    required
                    pattern={PORT_PATTERN.source}
                    aria-invalid={Boolean(errors.huiWebPort)}
                    onChange={(event) =>
                      setField("huiWebPort", event.target.value)
                    }
                  />
                </ConfigField>

                <ConfigField
                  label={t("config.huiWebContext")}
                  hint={t("config.contextHint")}
                  htmlFor="hui-web-context"
                  required
                  error={errors.huiWebContext}
                >
                  <Input
                    id="hui-web-context"
                    name="huiWebContext"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="font-mono"
                    value={form.huiWebContext}
                    required
                    pattern={CONTEXT_PATTERN.source}
                    aria-invalid={Boolean(errors.huiWebContext)}
                    onChange={(event) =>
                      setField("huiWebContext", event.target.value)
                    }
                  />
                </ConfigField>

                <ConfigField
                  label={t("config.hysteria2TrafficTime")}
                  hint={t("config.trafficTimeHint")}
                  htmlFor="hysteria2-traffic-time"
                  required
                  error={errors.hysteria2TrafficTime}
                >
                  <Input
                    id="hysteria2-traffic-time"
                    name="hysteria2TrafficTime"
                    inputMode="decimal"
                    autoComplete="off"
                    className="font-mono"
                    value={form.hysteria2TrafficTime}
                    required
                    pattern={TRAFFIC_TIME_PATTERN.source}
                    aria-invalid={Boolean(errors.hysteria2TrafficTime)}
                    onChange={(event) =>
                      setField("hysteria2TrafficTime", event.target.value)
                    }
                  />
                </ConfigField>

                <Separator />

                <section
                  ref={httpsSectionRef}
                  aria-labelledby="https-section-title"
                  className={cn(
                    "scroll-mt-24 rounded-xl border border-border bg-muted/30 p-4 transition-shadow",
                    highlightHttps && "ring-2 ring-ring/40"
                  )}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <h2
                          id="https-section-title"
                          className="text-sm font-medium"
                        >
                          {t("config.httpsSection")}
                        </h2>
                        <p className="max-w-md text-sm text-muted-foreground">
                          {t("config.httpsHint")}
                        </p>
                      </div>
                      {https && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={applyingCert}
                          onClick={() => void applyHysteria2Cert()}
                        >
                          {applyingCert ? (
                            <Spinner data-icon="inline-start" />
                          ) : (
                            <ShieldCheckIcon data-icon="inline-start" />
                          )}
                          {t("config.useHysteria2Cert")}
                        </Button>
                      )}
                    </div>

                    <Field orientation="horizontal">
                      <FieldLabel
                        htmlFor="hui-https"
                        className="font-mono text-xs"
                      >
                        {t("config.huiHttps")}
                      </FieldLabel>
                      <Switch
                        id="hui-https"
                        checked={https}
                        onCheckedChange={(checked) => {
                          setHttps(checked);
                          if (!checked) {
                            setErrors((prev) => ({
                              ...prev,
                              huiCrtPath: undefined,
                              huiKeyPath: undefined,
                            }));
                          }
                        }}
                      />
                    </Field>

                    {https && (
                      <div className="flex flex-col gap-4">
                        <ConfigField
                          label={t("config.huiCrtPath")}
                          htmlFor="hui-crt-path"
                          required
                          error={errors.huiCrtPath}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                              id="hui-crt-path"
                              name="huiCrtPath"
                              autoComplete="off"
                              spellCheck={false}
                              className="flex-1 font-mono"
                              value={form.huiCrtPath}
                              required
                              aria-invalid={Boolean(errors.huiCrtPath)}
                              onChange={(event) =>
                                setField("huiCrtPath", event.target.value)
                              }
                            />
                            <Button
                              type="button"
                              variant="outline"
                              disabled={uploading !== null}
                              onClick={() => crtInputRef.current?.click()}
                            >
                              {uploading === "crt" ? (
                                <Spinner data-icon="inline-start" />
                              ) : (
                                <UploadIcon data-icon="inline-start" />
                              )}
                              {t("config.uploadCrtFile")}
                            </Button>
                          </div>
                        </ConfigField>

                        <input
                          ref={crtInputRef}
                          type="file"
                          accept=".crt"
                          className="hidden"
                          onChange={handleCertFileChange("crt")}
                        />

                        <ConfigField
                          label={t("config.huiKeyPath")}
                          htmlFor="hui-key-path"
                          required
                          error={errors.huiKeyPath}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                              id="hui-key-path"
                              name="huiKeyPath"
                              autoComplete="off"
                              spellCheck={false}
                              className="flex-1 font-mono"
                              value={form.huiKeyPath}
                              required
                              aria-invalid={Boolean(errors.huiKeyPath)}
                              onChange={(event) =>
                                setField("huiKeyPath", event.target.value)
                              }
                            />
                            <Button
                              type="button"
                              variant="outline"
                              disabled={uploading !== null}
                              onClick={() => keyInputRef.current?.click()}
                            >
                              {uploading === "key" ? (
                                <Spinner data-icon="inline-start" />
                              ) : (
                                <UploadIcon data-icon="inline-start" />
                              )}
                              {t("config.uploadKeyFile")}
                            </Button>
                          </div>
                        </ConfigField>

                        <input
                          ref={keyInputRef}
                          type="file"
                          accept=".key"
                          className="hidden"
                          onChange={handleCertFileChange("key")}
                        />
                      </div>
                    )}
                  </div>
                </section>

                <Separator />

                <ConfigField
                  label={t("config.resetTrafficCron")}
                  hint={t("config.cronHint")}
                  htmlFor="reset-traffic-cron"
                  optional
                >
                  <div className="flex flex-col gap-2">
                    <Input
                      id="reset-traffic-cron"
                      name="resetTrafficCron"
                      autoComplete="off"
                      spellCheck={false}
                      className="font-mono"
                      value={form.resetTrafficCron}
                      onChange={(event) =>
                        setField("resetTrafficCron", event.target.value)
                      }
                    />
                    <div
                      className="flex flex-wrap items-center gap-2"
                      role="group"
                      aria-label={t("config.cronPreset")}
                    >
                      <span className="text-xs text-muted-foreground">
                        {t("config.cronPreset")}
                      </span>
                      {CRON_PRESETS.map((preset) => (
                        <Button
                          key={preset.value}
                          type="button"
                          size="xs"
                          variant={
                            form.resetTrafficCron === preset.value
                              ? "secondary"
                              : "outline"
                          }
                          aria-pressed={form.resetTrafficCron === preset.value}
                          onClick={() =>
                            setField("resetTrafficCron", preset.value)
                          }
                        >
                          {t(preset.labelKey)}
                        </Button>
                      ))}
                    </div>
                  </div>
                </ConfigField>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>

      <input
        ref={importInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportChange}
      />

      <ConfirmDialog
        open={restartOpen}
        onOpenChange={setRestartOpen}
        title={t("config.restartTitle")}
        description={t("config.restartDescription")}
        confirmLabel={t("config.restartNow")}
        destructive
        onConfirm={async () => {
          try {
            await restartServerApi();
            toast.success(t("config.restartTip"));
          } catch {
            /* the API layer already surfaced the error as a toast */
          }
        }}
      />
    </div>
  );
}
