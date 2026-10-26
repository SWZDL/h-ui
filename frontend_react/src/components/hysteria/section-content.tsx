import { UploadIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ConfigField } from "@/components/common/config-field";
import { KeyValueEditor } from "@/components/common/key-value-editor";
import { TagInput } from "@/components/common/tag-input";
import { OutboundsEditor } from "@/components/hysteria/outbounds-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useI18n } from "@/i18n";
import {
  type AclType,
  type HysteriaSection,
  type TlsType,
} from "@/lib/hysteria";
import type { Hysteria2ServerConfig } from "@/types/api";

const NONE_VALUE = "__none__";

interface Option {
  value: string;
  label: string;
}

/* ------------------------------------------------------------- primitives */

function TextField({
  label,
  hint,
  value,
  onChange,
  error,
  required,
  optional,
  placeholder,
  mono,
  type = "text",
  className,
  description,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  optional?: boolean;
  placeholder?: string;
  mono?: boolean;
  type?: "text" | "password";
  className?: string;
  description?: ReactNode;
}) {
  return (
    <ConfigField
      label={label}
      hint={hint}
      required={required}
      optional={optional}
      error={error}
      description={description}
      className={className}
    >
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className={mono ? "font-mono text-xs" : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </ConfigField>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  error,
  required,
  optional,
  placeholder,
  className,
}: {
  label: string;
  hint?: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  error?: string;
  required?: boolean;
  optional?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <ConfigField
      label={label}
      hint={hint}
      required={required}
      optional={optional}
      error={error}
      className={className}
    >
      <Input
        type="number"
        inputMode="numeric"
        value={value ?? ""}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className="font-mono text-xs tabular-nums"
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === "" ? undefined : Number(next));
        }}
      />
    </ConfigField>
  );
}

function SelectField({
  label,
  hint,
  value,
  onChange,
  options,
  allowClear,
  placeholder,
  className,
  required,
}: {
  label: string;
  hint?: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: Option[];
  allowClear?: boolean;
  placeholder?: string;
  className?: string;
  required?: boolean;
}) {
  const { t } = useI18n();

  return (
    <ConfigField label={label} hint={hint} required={required} className={className}>
      <Select
        value={value ?? ""}
        onValueChange={(next) => onChange(next === NONE_VALUE ? "" : next)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder ?? t("common.select")} />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {allowClear && (
              <SelectItem value={NONE_VALUE}>{t("common.none")}</SelectItem>
            )}
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </ConfigField>
  );
}

function SwitchField({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 rounded-lg border px-3 py-2">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-xs font-medium">{label}</span>
        {hint && (
          <span className="max-w-md text-xs leading-relaxed text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/* ------------------------------------------------------------------ types */

export interface SectionContentProps {
  section: HysteriaSection;
  config: Hysteria2ServerConfig;
  patch: (mutator: (draft: Hysteria2ServerConfig) => void) => void;
  tlsType: TlsType;
  onTlsTypeChange: (type: TlsType) => void;
  aclType: AclType;
  onAclTypeChange: (type: AclType) => void;
  errors: Record<string, string>;
  uploading: "crt" | "key" | null;
  onUploadCert: (kind: "crt" | "key") => void;
  extension: { remark: string; portHopping: string; clashExtension: string };
  onExtensionChange: (
    next: Partial<{ remark: string; portHopping: string; clashExtension: string }>
  ) => void;
}

export function SectionContent(props: SectionContentProps) {
  const { t } = useI18n();
  const {
    section,
    config,
    patch,
    tlsType,
    onTlsTypeChange,
    aclType,
    onAclTypeChange,
    errors,
    uploading,
    onUploadCert,
    extension,
    onExtensionChange,
  } = props;

  const updateTls = (
    mutate: (tls: NonNullable<Hysteria2ServerConfig["tls"]>) => void
  ) =>
    patch((draft) => {
      draft.tls = draft.tls ?? { cert: "", key: "" };
      mutate(draft.tls);
    });

  const updateAcme = (
    mutate: (acme: NonNullable<Hysteria2ServerConfig["acme"]>) => void
  ) =>
    patch((draft) => {
      if (draft.acme) mutate(draft.acme);
    });

  const updateObfs = (
    mutate: (obfs: NonNullable<Hysteria2ServerConfig["obfs"]>) => void
  ) =>
    patch((draft) => {
      if (draft.obfs) mutate(draft.obfs);
    });

  const updateQuic = (
    mutate: (quic: NonNullable<Hysteria2ServerConfig["quic"]>) => void
  ) =>
    patch((draft) => {
      if (draft.quic) mutate(draft.quic);
    });

  const updateResolver = (
    mutate: (resolver: NonNullable<Hysteria2ServerConfig["resolver"]>) => void
  ) =>
    patch((draft) => {
      if (draft.resolver) mutate(draft.resolver);
    });

  const updateSniff = (
    mutate: (sniff: NonNullable<Hysteria2ServerConfig["sniff"]>) => void
  ) =>
    patch((draft) => {
      if (draft.sniff) mutate(draft.sniff);
    });

  const updateAcl = (
    mutate: (acl: NonNullable<Hysteria2ServerConfig["acl"]>) => void
  ) =>
    patch((draft) => {
      if (draft.acl) mutate(draft.acl);
    });

  const updateMasquerade = (
    mutate: (masquerade: NonNullable<Hysteria2ServerConfig["masquerade"]>) => void
  ) =>
    patch((draft) => {
      if (draft.masquerade) mutate(draft.masquerade);
    });

  const updateBandwidth = (
    mutate: (bandwidth: NonNullable<Hysteria2ServerConfig["bandwidth"]>) => void
  ) =>
    patch((draft) => {
      if (draft.bandwidth) mutate(draft.bandwidth);
    });

  const updateCongestion = (
    mutate: (congestion: NonNullable<Hysteria2ServerConfig["congestion"]>) => void
  ) =>
    patch((draft) => {
      if (draft.congestion) mutate(draft.congestion);
    });

  switch (section) {
    /* ------------------------------------------------------------ extension */
    case "extension":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="remark"
            hint={t("hysteria.config.remark")}
            value={extension.remark}
            onChange={(value) => onExtensionChange({ remark: value })}
            placeholder={t("account.remark")}
            className="md:col-span-2"
          />
          <TextField
            label="portHopping"
            hint={t("hysteria.config.portHopping")}
            value={extension.portHopping}
            onChange={(value) => onExtensionChange({ portHopping: value })}
            placeholder="20000-50000"
            mono
            className="md:col-span-2"
          />
          <ConfigField
            label="clashExtension"
            hint={t("hysteria.config.clashExtension")}
            className="md:col-span-2"
          >
            <Textarea
              rows={5}
              value={extension.clashExtension}
              className="font-mono text-xs"
              onChange={(event) =>
                onExtensionChange({ clashExtension: event.target.value })
              }
            />
          </ConfigField>
        </div>
      );

    /* --------------------------------------------------------------- listen */
    case "listen":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="listen"
            hint={t("hysteria.config.listen")}
            value={config.listen}
            required
            error={errors.listen}
            placeholder=":443"
            mono
            onChange={(value) => patch((draft) => void (draft.listen = value))}
          />
        </div>
      );

    /* ------------------------------------------------------------------ tls */
    case "tls": {
      const acmeType = config.acme?.type ?? "";
      return (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium">{t("hysteria.config.tlsType")}</span>
            <ToggleGroup
              type="single"
              value={tlsType}
              variant="outline"
              size="sm"
              spacing={0}
              onValueChange={(value) => {
                if (value) onTlsTypeChange(value as TlsType);
              }}
            >
              <ToggleGroupItem value="tls">TLS</ToggleGroupItem>
              <ToggleGroupItem value="acme">ACME</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {tlsType === "tls" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <ConfigField
                label="tls.cert"
                hint={t("hysteria.config.tls.cert")}
                required
              >
                <div className="flex gap-2">
                  <Input
                    className="font-mono text-xs"
                    value={config.tls?.cert ?? ""}
                    placeholder="/path/to/cert.crt"
                    onChange={(event) =>
                      updateTls((tls) => void (tls.cert = event.target.value))
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading !== null}
                    onClick={() => onUploadCert("crt")}
                  >
                    {uploading === "crt" ? (
                      <Spinner />
                    ) : (
                      <UploadIcon data-icon="inline-start" />
                    )}
                    {t("config.uploadCrtFile")}
                  </Button>
                </div>
              </ConfigField>

              <ConfigField
                label="tls.key"
                hint={t("hysteria.config.tls.key")}
                required
              >
                <div className="flex gap-2">
                  <Input
                    className="font-mono text-xs"
                    value={config.tls?.key ?? ""}
                    placeholder="/path/to/key.key"
                    onChange={(event) =>
                      updateTls((tls) => void (tls.key = event.target.value))
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading !== null}
                    onClick={() => onUploadCert("key")}
                  >
                    {uploading === "key" ? (
                      <Spinner />
                    ) : (
                      <UploadIcon data-icon="inline-start" />
                    )}
                    {t("config.uploadKeyFile")}
                  </Button>
                </div>
              </ConfigField>

              <SelectField
                label="tls.sniGuard"
                hint={t("hysteria.config.tls.sniGuard")}
                value={config.tls?.sniGuard ?? ""}
                allowClear
                options={[
                  { value: "dns-san", label: "dns-san" },
                  { value: "strict", label: "strict" },
                  { value: "disable", label: "disable" },
                ]}
                onChange={(value) =>
                  updateTls((tls) => void (tls.sniGuard = value))
                }
              />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <ConfigField
                label="acme.domains"
                hint={t("hysteria.config.acme.domains")}
                required
                className="md:col-span-2"
              >
                <TagInput
                  value={config.acme?.domains ?? []}
                  onChange={(value) =>
                    updateAcme((acme) => void (acme.domains = value))
                  }
                  placeholder="example.com"
                  emptyLabel={t("hysteria.noTags")}
                />
              </ConfigField>

              <TextField
                label="acme.email"
                hint={t("hysteria.config.acme.email")}
                value={config.acme?.email ?? ""}
                onChange={(value) => updateAcme((acme) => void (acme.email = value))}
                placeholder="admin@example.com"
              />

              <SelectField
                label="acme.ca"
                hint={t("hysteria.config.acme.ca")}
                value={config.acme?.ca}
                options={[
                  { value: "zerossl", label: "zerossl" },
                  { value: "letsencrypt", label: "letsencrypt" },
                ]}
                onChange={(value) => updateAcme((acme) => void (acme.ca = value))}
              />

              <TextField
                label="acme.listenHost"
                hint={t("hysteria.config.acme.listenHost")}
                value={config.acme?.listenHost ?? ""}
                onChange={(value) =>
                  updateAcme((acme) => void (acme.listenHost = value))
                }
                mono
              />

              <TextField
                label="acme.dir"
                hint={t("hysteria.config.acme.dir")}
                value={config.acme?.dir ?? ""}
                onChange={(value) => updateAcme((acme) => void (acme.dir = value))}
                mono
              />

              <SelectField
                label="acme.type"
                hint={t("hysteria.config.acme.type")}
                value={acmeType}
                allowClear
                options={[
                  { value: "http", label: "http" },
                  { value: "tls", label: "tls" },
                  { value: "dns", label: "dns" },
                ]}
                onChange={(value) => updateAcme((acme) => void (acme.type = value))}
              />

              {acmeType === "http" && (
                <NumberField
                  label="acme.http.altPort"
                  hint={t("hysteria.config.acme.http.altPort")}
                  value={config.acme?.http?.altPort}
                  onChange={(value) =>
                    updateAcme((acme) => {
                      acme.http = { altPort: value ?? 8888 };
                    })
                  }
                />
              )}

              {acmeType === "tls" && (
                <NumberField
                  label="acme.tls.altPort"
                  hint={t("hysteria.config.acme.tls.altPort")}
                  value={config.acme?.tls?.altPort}
                  onChange={(value) =>
                    updateAcme((acme) => {
                      acme.tls = { altPort: value ?? 44333 };
                    })
                  }
                />
              )}

              {acmeType === "dns" && (
                <>
                  <SelectField
                    label="acme.dns.name"
                    hint={t("hysteria.config.acme.dns.name")}
                    value={config.acme?.dns?.name}
                    options={[
                      { value: "cloudflare", label: "cloudflare" },
                      { value: "duckdns", label: "duckdns" },
                      { value: "gandi", label: "gandi" },
                      { value: "godaddy", label: "godaddy" },
                      { value: "namedotcom", label: "namedotcom" },
                      { value: "vultr", label: "vultr" },
                      { value: "gomommy", label: "gomommy" },
                    ]}
                    onChange={(value) =>
                      updateAcme((acme) => {
                        acme.dns = { name: value, config: acme.dns?.config ?? {} };
                      })
                    }
                  />
                  <ConfigField
                    label="acme.dns.config"
                    hint={t("hysteria.config.acme.dns.config")}
                    className="md:col-span-2"
                  >
                    <KeyValueEditor
                      value={config.acme?.dns?.config ?? {}}
                      onChange={(value) =>
                        updateAcme((acme) => {
                          acme.dns = {
                            name: acme.dns?.name ?? "gomommy",
                            config: value,
                          };
                        })
                      }
                      keyPlaceholder="CF_API_TOKEN"
                    />
                  </ConfigField>
                </>
              )}

              {acmeType === "" && (
                <>
                  <SwitchField
                    label="acme.disableHTTP"
                    hint={t("hysteria.config.acme.disableHTTP")}
                    checked={Boolean(config.acme?.disableHTTP)}
                    onCheckedChange={(checked) =>
                      updateAcme((acme) => void (acme.disableHTTP = checked))
                    }
                  />
                  <SwitchField
                    label="acme.disableTLSALPN"
                    hint={t("hysteria.config.acme.disableTLSALPN")}
                    checked={Boolean(config.acme?.disableTLSALPN)}
                    onCheckedChange={(checked) =>
                      updateAcme((acme) => void (acme.disableTLSALPN = checked))
                    }
                  />
                  <NumberField
                    label="acme.altHTTPPort"
                    hint={t("hysteria.config.acme.altHTTPPort")}
                    value={config.acme?.altHTTPPort}
                    onChange={(value) =>
                      updateAcme((acme) => void (acme.altHTTPPort = value ?? 80))
                    }
                  />
                  <NumberField
                    label="acme.altTLSALPNPort"
                    hint={t("hysteria.config.acme.altTLSALPNPort")}
                    value={config.acme?.altTLSALPNPort}
                    onChange={(value) =>
                      updateAcme(
                        (acme) => void (acme.altTLSALPNPort = value ?? 443)
                      )
                    }
                  />
                </>
              )}
            </div>
          )}
        </div>
      );
    }

    /* ------------------------------------------------------------------ ech */
    case "ech":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="ech.keyPath"
            hint={t("hysteria.config.ech.keyPath")}
            value={config.ech?.keyPath ?? ""}
            mono
            onChange={(value) =>
              patch((draft) => {
                draft.ech = { keyPath: value };
              })
            }
          />
        </div>
      );

    /* ----------------------------------------------------------------- obfs */
    case "obfs": {
      const obfsType = config.obfs?.type ?? "";
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="obfs.type"
            hint={t("hysteria.config.obfs.type")}
            value={obfsType}
            options={[
              { value: "salamander", label: "salamander" },
              { value: "gecko", label: "gecko" },
            ]}
            onChange={(value) => updateObfs((obfs) => void (obfs.type = value))}
          />

          {obfsType === "salamander" && (
            <TextField
              label="obfs.salamander.password"
              hint={t("hysteria.config.obfs.salamander.password")}
              value={config.obfs?.salamander?.password ?? ""}
              type="password"
              onChange={(value) =>
                updateObfs((obfs) => {
                  obfs.salamander = { password: value };
                })
              }
            />
          )}

          {obfsType === "gecko" && (
            <>
              <TextField
                label="obfs.gecko.password"
                hint={t("hysteria.config.obfs.gecko.password")}
                value={config.obfs?.gecko?.password ?? ""}
                type="password"
                onChange={(value) =>
                  updateObfs((obfs) => {
                    obfs.gecko = {
                      password: value,
                      minPacketSize: obfs.gecko?.minPacketSize ?? 512,
                      maxPacketSize: obfs.gecko?.maxPacketSize ?? 1200,
                    };
                  })
                }
              />
              <NumberField
                label="obfs.gecko.minPacketSize"
                hint={t("hysteria.config.obfs.gecko.minPacketSize")}
                value={config.obfs?.gecko?.minPacketSize}
                onChange={(value) =>
                  updateObfs((obfs) => {
                    if (obfs.gecko) obfs.gecko.minPacketSize = value ?? 512;
                  })
                }
              />
              <NumberField
                label="obfs.gecko.maxPacketSize"
                hint={t("hysteria.config.obfs.gecko.maxPacketSize")}
                value={config.obfs?.gecko?.maxPacketSize}
                onChange={(value) =>
                  updateObfs((obfs) => {
                    if (obfs.gecko) obfs.gecko.maxPacketSize = value ?? 1200;
                  })
                }
              />
            </>
          )}
        </div>
      );
    }

    /* ----------------------------------------------------------------- quic */
    case "quic":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField
            label="quic.initStreamReceiveWindow"
            hint={t("hysteria.config.quic.initStreamReceiveWindow")}
            value={config.quic?.initStreamReceiveWindow}
            onChange={(value) =>
              updateQuic((quic) => void (quic.initStreamReceiveWindow = value))
            }
          />
          <NumberField
            label="quic.maxStreamReceiveWindow"
            hint={t("hysteria.config.quic.maxStreamReceiveWindow")}
            value={config.quic?.maxStreamReceiveWindow}
            onChange={(value) =>
              updateQuic((quic) => void (quic.maxStreamReceiveWindow = value))
            }
          />
          <NumberField
            label="quic.initConnReceiveWindow"
            hint={t("hysteria.config.quic.initConnReceiveWindow")}
            value={config.quic?.initConnReceiveWindow}
            onChange={(value) =>
              updateQuic((quic) => void (quic.initConnReceiveWindow = value))
            }
          />
          <NumberField
            label="quic.maxConnReceiveWindow"
            hint={t("hysteria.config.quic.maxConnReceiveWindow")}
            value={config.quic?.maxConnReceiveWindow}
            onChange={(value) =>
              updateQuic((quic) => void (quic.maxConnReceiveWindow = value))
            }
          />
          <TextField
            label="quic.maxIdleTimeout"
            hint={t("hysteria.config.quic.maxIdleTimeout")}
            value={config.quic?.maxIdleTimeout ?? ""}
            mono
            onChange={(value) =>
              updateQuic((quic) => void (quic.maxIdleTimeout = value))
            }
          />
          <NumberField
            label="quic.maxIncomingStreams"
            hint={t("hysteria.config.quic.maxIncomingStreams")}
            value={config.quic?.maxIncomingStreams}
            onChange={(value) =>
              updateQuic((quic) => void (quic.maxIncomingStreams = value))
            }
          />
          <SwitchField
            label="quic.disablePathMTUDiscovery"
            hint={t("hysteria.config.quic.disablePathMTUDiscovery")}
            checked={Boolean(config.quic?.disablePathMTUDiscovery)}
            onCheckedChange={(checked) =>
              updateQuic((quic) => void (quic.disablePathMTUDiscovery = checked))
            }
          />
        </div>
      );

    /* ------------------------------------------------------------ bandwidth */
    case "bandwidth":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="bandwidth.up"
            hint={t("hysteria.config.bandwidth.up")}
            value={config.bandwidth?.up ?? ""}
            onChange={(value) =>
              updateBandwidth((bandwidth) => void (bandwidth.up = value))
            }
            placeholder="1 gbps"
          />
          <TextField
            label="bandwidth.down"
            hint={t("hysteria.config.bandwidth.down")}
            value={config.bandwidth?.down ?? ""}
            onChange={(value) =>
              updateBandwidth((bandwidth) => void (bandwidth.down = value))
            }
            placeholder="1 gbps"
          />
          <SwitchField
            label="bandwidth.disableLossCompensation"
            hint={t("hysteria.config.bandwidth.disableLossCompensation")}
            checked={Boolean(config.bandwidth?.disableLossCompensation)}
            onCheckedChange={(checked) =>
              updateBandwidth(
                (bandwidth) => void (bandwidth.disableLossCompensation = checked)
              )
            }
          />
          <SwitchField
            label="ignoreClientBandwidth"
            hint={t("hysteria.config.ignoreClientBandwidth")}
            checked={Boolean(config.ignoreClientBandwidth)}
            onCheckedChange={(checked) =>
              patch((draft) => void (draft.ignoreClientBandwidth = checked))
            }
          />
          <SelectField
            label="congestion.type"
            hint={t("hysteria.config.congestion.type")}
            value={config.congestion?.type}
            options={[
              { value: "bbr", label: "bbr" },
              { value: "reno", label: "reno" },
            ]}
            onChange={(value) =>
              updateCongestion((congestion) => void (congestion.type = value))
            }
          />
          {config.congestion?.type === "bbr" && (
            <SelectField
              label="congestion.bbrProfile"
              hint={t("hysteria.config.congestion.bbrProfile")}
              value={config.congestion?.bbrProfile}
              options={[
                { value: "standard", label: "standard" },
                { value: "conservative", label: "conservative" },
                { value: "aggressive", label: "aggressive" },
              ]}
              onChange={(value) =>
                updateCongestion(
                  (congestion) => void (congestion.bbrProfile = value)
                )
              }
            />
          )}
        </div>
      );

    /* ------------------------------------------------------------ speedTest */
    case "speedTest":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <SwitchField
            label="speedTest"
            hint={t("hysteria.config.speedTest")}
            checked={Boolean(config.speedTest)}
            onCheckedChange={(checked) =>
              patch((draft) => void (draft.speedTest = checked))
            }
          />
        </div>
      );

    /* ------------------------------------------------------------------ udp */
    case "udp":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <SwitchField
            label="disableUDP"
            hint={t("hysteria.config.disableUDP")}
            checked={Boolean(config.disableUDP)}
            onCheckedChange={(checked) =>
              patch((draft) => void (draft.disableUDP = checked))
            }
          />
          <TextField
            label="udpIdleTimeout"
            hint={t("hysteria.config.udpIdleTimeout")}
            value={config.udpIdleTimeout ?? ""}
            placeholder="60s"
            mono
            onChange={(value) =>
              patch((draft) => void (draft.udpIdleTimeout = value))
            }
          />
        </div>
      );

    /* ------------------------------------------------------------- resolver */
    case "resolver": {
      const resolverType = config.resolver?.type ?? "";
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="resolver.type"
            hint={t("hysteria.config.resolver.type")}
            value={resolverType}
            allowClear
            options={[
              { value: "tcp", label: "tcp" },
              { value: "udp", label: "udp" },
              { value: "tls", label: "tls" },
              { value: "https", label: "https" },
            ]}
            onChange={(value) =>
              updateResolver((resolver) => void (resolver.type = value))
            }
          />

          {resolverType === "tcp" && (
            <>
              <TextField
                label="resolver.tcp.addr"
                hint={t("hysteria.config.resolver.tcp.addr")}
                value={config.resolver?.tcp?.addr ?? ""}
                mono
                onChange={(value) =>
                  updateResolver((resolver) => {
                    resolver.tcp = {
                      addr: value,
                      timeout: resolver.tcp?.timeout ?? "4s",
                    };
                  })
                }
              />
              <TextField
                label="resolver.tcp.timeout"
                hint={t("hysteria.config.resolver.tcp.timeout")}
                value={config.resolver?.tcp?.timeout ?? ""}
                mono
                onChange={(value) =>
                  updateResolver((resolver) => {
                    if (resolver.tcp) resolver.tcp.timeout = value;
                  })
                }
              />
            </>
          )}

          {resolverType === "udp" && (
            <>
              <TextField
                label="resolver.udp.addr"
                hint={t("hysteria.config.resolver.udp.addr")}
                value={config.resolver?.udp?.addr ?? ""}
                mono
                onChange={(value) =>
                  updateResolver((resolver) => {
                    resolver.udp = {
                      addr: value,
                      timeout: resolver.udp?.timeout ?? "4s",
                    };
                  })
                }
              />
              <TextField
                label="resolver.udp.timeout"
                hint={t("hysteria.config.resolver.udp.timeout")}
                value={config.resolver?.udp?.timeout ?? ""}
                mono
                onChange={(value) =>
                  updateResolver((resolver) => {
                    if (resolver.udp) resolver.udp.timeout = value;
                  })
                }
              />
            </>
          )}

          {(resolverType === "tls" || resolverType === "https") && (
            <>
              <TextField
                label={`resolver.${resolverType}.addr`}
                hint={t(`hysteria.config.resolver.${resolverType}.addr`)}
                value={
                  resolverType === "tls"
                    ? config.resolver?.tls?.addr ?? ""
                    : config.resolver?.https?.addr ?? ""
                }
                mono
                onChange={(value) =>
                  updateResolver((resolver) => {
                    if (resolverType === "tls") {
                      resolver.tls = {
                        addr: value,
                        timeout: resolver.tls?.timeout ?? "10s",
                        sni: resolver.tls?.sni ?? "",
                        insecure: Boolean(resolver.tls?.insecure),
                      };
                    } else {
                      resolver.https = {
                        addr: value,
                        timeout: resolver.https?.timeout ?? "10s",
                        sni: resolver.https?.sni ?? "",
                        insecure: Boolean(resolver.https?.insecure),
                      };
                    }
                  })
                }
              />
              <TextField
                label={`resolver.${resolverType}.timeout`}
                hint={t(`hysteria.config.resolver.${resolverType}.timeout`)}
                value={
                  resolverType === "tls"
                    ? config.resolver?.tls?.timeout ?? ""
                    : config.resolver?.https?.timeout ?? ""
                }
                mono
                onChange={(value) =>
                  updateResolver((resolver) => {
                    if (resolverType === "tls") {
                      if (resolver.tls) resolver.tls.timeout = value;
                    } else if (resolver.https) {
                      resolver.https.timeout = value;
                    }
                  })
                }
              />
              <TextField
                label={`resolver.${resolverType}.sni`}
                hint={t(`hysteria.config.resolver.${resolverType}.sni`)}
                value={
                  resolverType === "tls"
                    ? config.resolver?.tls?.sni ?? ""
                    : config.resolver?.https?.sni ?? ""
                }
                mono
                onChange={(value) =>
                  updateResolver((resolver) => {
                    if (resolverType === "tls") {
                      if (resolver.tls) resolver.tls.sni = value;
                    } else if (resolver.https) {
                      resolver.https.sni = value;
                    }
                  })
                }
              />
              <SwitchField
                label={`resolver.${resolverType}.insecure`}
                hint={t(`hysteria.config.resolver.${resolverType}.insecure`)}
                checked={
                  resolverType === "tls"
                    ? Boolean(config.resolver?.tls?.insecure)
                    : Boolean(config.resolver?.https?.insecure)
                }
                onCheckedChange={(checked) =>
                  updateResolver((resolver) => {
                    if (resolverType === "tls") {
                      if (resolver.tls) resolver.tls.insecure = checked;
                    } else if (resolver.https) {
                      resolver.https.insecure = checked;
                    }
                  })
                }
              />
            </>
          )}
        </div>
      );
    }

    /* ---------------------------------------------------------------- sniff */
    case "sniff":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <SwitchField
            label="sniff.enable"
            hint={t("hysteria.config.sniff.enable")}
            checked={Boolean(config.sniff?.enable)}
            onCheckedChange={(checked) =>
              updateSniff((sniff) => void (sniff.enable = checked))
            }
          />
          <TextField
            label="sniff.timeout"
            hint={t("hysteria.config.sniff.timeout")}
            value={config.sniff?.timeout ?? ""}
            mono
            onChange={(value) =>
              updateSniff((sniff) => void (sniff.timeout = value))
            }
          />
          <SwitchField
            label="sniff.rewriteDomain"
            hint={t("hysteria.config.sniff.rewriteDomain")}
            checked={Boolean(config.sniff?.rewriteDomain)}
            onCheckedChange={(checked) =>
              updateSniff((sniff) => void (sniff.rewriteDomain = checked))
            }
          />
          <div />
          <TextField
            label="sniff.tcpPorts"
            hint={t("hysteria.config.sniff.tcpPorts")}
            value={config.sniff?.tcpPorts ?? ""}
            mono
            onChange={(value) =>
              updateSniff((sniff) => void (sniff.tcpPorts = value))
            }
          />
          <TextField
            label="sniff.udpPorts"
            hint={t("hysteria.config.sniff.udpPorts")}
            value={config.sniff?.udpPorts ?? ""}
            mono
            onChange={(value) =>
              updateSniff((sniff) => void (sniff.udpPorts = value))
            }
          />
        </div>
      );

    /* ------------------------------------------------------------------ acl */
    case "acl":
      return (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium">{t("hysteria.config.aclType")}</span>
            <ToggleGroup
              type="single"
              value={aclType}
              variant="outline"
              size="sm"
              spacing={0}
              onValueChange={(value) => {
                if (value) onAclTypeChange(value as AclType);
              }}
            >
              <ToggleGroupItem value="inline">inline</ToggleGroupItem>
              <ToggleGroupItem value="file">file</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {aclType === "file" ? (
              <TextField
                label="acl.file"
                hint={t("hysteria.config.acl.file")}
                value={config.acl?.file ?? ""}
                mono
                onChange={(value) =>
                  updateAcl((acl) => void (acl.file = value))
                }
              />
            ) : (
              <ConfigField
                label="acl.inline"
                hint={t("hysteria.config.acl.inline")}
                className="md:col-span-2"
              >
                <TagInput
                  value={config.acl?.inline ?? []}
                  onChange={(value) =>
                    updateAcl((acl) => void (acl.inline = value))
                  }
                  placeholder="reject(all, udp/443)"
                  emptyLabel={t("hysteria.noTags")}
                />
              </ConfigField>
            )}

            <TextField
              label="acl.geoip"
              hint={t("hysteria.config.acl.geoip")}
              value={config.acl?.geoip ?? ""}
              mono
              optional
              onChange={(value) => updateAcl((acl) => void (acl.geoip = value))}
            />
            <TextField
              label="acl.geosite"
              hint={t("hysteria.config.acl.geosite")}
              value={config.acl?.geosite ?? ""}
              mono
              optional
              onChange={(value) => updateAcl((acl) => void (acl.geosite = value))}
            />
            <TextField
              label="acl.geoUpdateInterval"
              hint={t("hysteria.config.acl.geoUpdateInterval")}
              value={config.acl?.geoUpdateInterval ?? ""}
              mono
              onChange={(value) =>
                updateAcl((acl) => void (acl.geoUpdateInterval = value))
              }
            />
          </div>
        </div>
      );

    /* ------------------------------------------------------------ outbounds */
    case "outbounds":
      return (
        <OutboundsEditor
          value={config.outbounds ?? []}
          onChange={(value) =>
            patch((draft) => void (draft.outbounds = value))
          }
        />
      );

    /* ----------------------------------------------------------------- http */
    case "http":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="trafficStats.listen"
            hint={t("hysteria.config.trafficStats.listen")}
            value={config.trafficStats.listen}
            required
            error={errors["trafficStats.listen"]}
            placeholder=":9999"
            mono
            onChange={(value) =>
              patch((draft) => void (draft.trafficStats.listen = value))
            }
          />
        </div>
      );

    /* ----------------------------------------------------------- masquerade */
    case "masquerade": {
      const type = config.masquerade?.type ?? "";
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="masquerade.type"
            hint={t("hysteria.config.masquerade.type")}
            value={type}
            allowClear
            options={[
              { value: "file", label: "file" },
              { value: "proxy", label: "proxy" },
              { value: "string", label: "string" },
            ]}
            onChange={(value) =>
              updateMasquerade((masquerade) => void (masquerade.type = value))
            }
          />

          {type === "file" && (
            <TextField
              label="masquerade.file.dir"
              hint={t("hysteria.config.masquerade.file.dir")}
              value={config.masquerade?.file?.dir ?? ""}
              mono
              onChange={(value) =>
                updateMasquerade((masquerade) => {
                  masquerade.file = { dir: value };
                })
              }
            />
          )}

          {type === "proxy" && (
            <>
              <TextField
                label="masquerade.proxy.url"
                hint={t("hysteria.config.masquerade.proxy.url")}
                value={config.masquerade?.proxy?.url ?? ""}
                mono
                onChange={(value) =>
                  updateMasquerade((masquerade) => {
                    masquerade.proxy = {
                      url: value,
                      rewriteHost: masquerade.proxy?.rewriteHost ?? true,
                      insecure: masquerade.proxy?.insecure ?? false,
                      xForwarded: masquerade.proxy?.xForwarded ?? false,
                    };
                  })
                }
              />
              <SwitchField
                label="masquerade.proxy.rewriteHost"
                hint={t("hysteria.config.masquerade.proxy.rewriteHost")}
                checked={Boolean(config.masquerade?.proxy?.rewriteHost)}
                onCheckedChange={(checked) =>
                  updateMasquerade((masquerade) => {
                    if (masquerade.proxy) masquerade.proxy.rewriteHost = checked;
                  })
                }
              />
              <SwitchField
                label="masquerade.proxy.insecure"
                hint={t("hysteria.config.masquerade.proxy.insecure")}
                checked={Boolean(config.masquerade?.proxy?.insecure)}
                onCheckedChange={(checked) =>
                  updateMasquerade((masquerade) => {
                    if (masquerade.proxy) masquerade.proxy.insecure = checked;
                  })
                }
              />
              <SwitchField
                label="masquerade.proxy.xForwarded"
                hint={t("hysteria.config.masquerade.proxy.xForwarded")}
                checked={Boolean(config.masquerade?.proxy?.xForwarded)}
                onCheckedChange={(checked) =>
                  updateMasquerade((masquerade) => {
                    if (masquerade.proxy) masquerade.proxy.xForwarded = checked;
                  })
                }
              />
            </>
          )}

          {type === "string" && (
            <>
              <TextField
                label="masquerade.string.content"
                hint={t("hysteria.config.masquerade.string.content")}
                value={config.masquerade?.string?.content ?? ""}
                onChange={(value) =>
                  updateMasquerade((masquerade) => {
                    masquerade.string = {
                      content: value,
                      headers: masquerade.string?.headers ?? {},
                      statusCode: masquerade.string?.statusCode ?? 200,
                    };
                  })
                }
              />
              <NumberField
                label="masquerade.string.statusCode"
                hint={t("hysteria.config.masquerade.string.statusCode")}
                value={config.masquerade?.string?.statusCode}
                onChange={(value) =>
                  updateMasquerade((masquerade) => {
                    if (masquerade.string) {
                      masquerade.string.statusCode = value ?? 200;
                    }
                  })
                }
              />
              <ConfigField
                label="masquerade.string.headers"
                hint={t("hysteria.config.masquerade.string.headers")}
                className="md:col-span-2"
              >
                <KeyValueEditor
                  value={config.masquerade?.string?.headers ?? {}}
                  onChange={(value) =>
                    updateMasquerade((masquerade) => {
                      masquerade.string = {
                        content: masquerade.string?.content ?? "",
                        headers: value,
                        statusCode: masquerade.string?.statusCode ?? 200,
                      };
                    })
                  }
                  keyPlaceholder="Content-Type"
                  valuePlaceholder="text/html"
                />
              </ConfigField>
            </>
          )}

          <TextField
            label="masquerade.listenHTTP"
            hint={t("hysteria.config.masquerade.listenHTTP")}
            value={config.masquerade?.listenHTTP ?? ""}
            mono
            onChange={(value) =>
              updateMasquerade((masquerade) => void (masquerade.listenHTTP = value))
            }
          />
          <TextField
            label="masquerade.listenHTTPS"
            hint={t("hysteria.config.masquerade.listenHTTPS")}
            value={config.masquerade?.listenHTTPS ?? ""}
            mono
            onChange={(value) =>
              updateMasquerade(
                (masquerade) => void (masquerade.listenHTTPS = value)
              )
            }
          />
          <SwitchField
            label="masquerade.forceHTTPS"
            hint={t("hysteria.config.masquerade.forceHTTPS")}
            checked={Boolean(config.masquerade?.forceHTTPS)}
            onCheckedChange={(checked) =>
              updateMasquerade(
                (masquerade) => void (masquerade.forceHTTPS = checked)
              )
            }
          />
        </div>
      );
    }

    default:
      return null;
  }
}
