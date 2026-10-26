import { InfoIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfigField } from "@/components/common/config-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { deepCopy } from "@/lib/format";
import { defaultHysteria2ServerConfigOutbound } from "@/lib/hysteria";
import type { Hysteria2ServerConfigOutbound } from "@/types/api";

const OUTBOUND_TYPES = ["socks5", "http", "direct"];
const DIRECT_MODES = ["auto", "64", "46", "6", "4"];

interface OutboundsEditorProps {
  value: Hysteria2ServerConfigOutbound[];
  onChange: (value: Hysteria2ServerConfigOutbound[]) => void;
}

export function OutboundsEditor({ value, onChange }: OutboundsEditorProps) {
  const { t } = useI18n();
  const [addOpen, setAddOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoTarget, setInfoTarget] = useState<Hysteria2ServerConfigOutbound | null>(
    null
  );
  const [form, setForm] = useState<Hysteria2ServerConfigOutbound>(() =>
    deepCopy(defaultHysteria2ServerConfigOutbound)
  );
  const [nameError, setNameError] = useState<string>();

  const openAdd = () => {
    setForm(deepCopy(defaultHysteria2ServerConfigOutbound));
    setNameError(undefined);
    setAddOpen(true);
  };

  const update = <K extends keyof Hysteria2ServerConfigOutbound>(
    key: K,
    next: Hysteria2ServerConfigOutbound[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: next }));
  };

  const submit = () => {
    const name = form.name.trim();
    if (!name) {
      setNameError(t("common.required"));
      return;
    }
    if (value.some((item) => item.name === name)) {
      setNameError(t("common.valueExists"));
      return;
    }

    const outbound: Hysteria2ServerConfigOutbound = { name, type: form.type };
    if (form.type === "socks5") {
      outbound.socks5 = {
        addr: form.socks5?.addr ?? "",
        username: form.socks5?.username || undefined,
        password: form.socks5?.password || undefined,
      };
    } else if (form.type === "http") {
      outbound.http = {
        url: form.http?.url ?? "",
        insecure: Boolean(form.http?.insecure),
      };
    } else {
      outbound.direct = {
        mode: form.direct?.mode || "auto",
        bindIPv4: form.direct?.bindIPv4 || undefined,
        bindIPv6: form.direct?.bindIPv6 || undefined,
        bindDevice: form.direct?.bindDevice || undefined,
        fastOpen: Boolean(form.direct?.fastOpen),
      };
    }

    onChange([...value, outbound]);
    setAddOpen(false);
  };

  const remove = (name: string) => {
    onChange(value.filter((item) => item.name !== name));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {value.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("hysteria.noOutbounds")}</p>
        )}
        {value.map((outbound) => (
          <Badge
            key={outbound.name}
            variant="secondary"
            className="h-7 gap-1 pr-1 font-mono text-xs font-normal"
          >
            <button
              type="button"
              className="flex items-center gap-1"
              onClick={() => {
                setInfoTarget(outbound);
                setInfoOpen(true);
              }}
            >
              <InfoIcon className="size-3 text-muted-foreground" />
              {outbound.name}
            </button>
            <button
              type="button"
              className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
              aria-label={`${t("common.remove")} ${outbound.name}`}
              onClick={() => remove(outbound.name)}
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={openAdd}>
          <PlusIcon data-icon="inline-start" />
          {t("hysteria.outboundAdd")}
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("hysteria.outboundAdd")}</DialogTitle>
            <DialogDescription>{t("hysteria.outboundInfo")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <ConfigField
              label="name"
              hint={t("hysteria.config.outbounds.name")}
              required
              error={nameError}
            >
              <Input
                value={form.name}
                aria-invalid={Boolean(nameError)}
                placeholder={t("hysteria.outboundName")}
                onChange={(event) => {
                  update("name", event.target.value);
                  setNameError(undefined);
                }}
              />
            </ConfigField>

            <ConfigField label="type" hint={t("hysteria.config.outbounds.type")}>
              <Select
                value={form.type}
                onValueChange={(next) => update("type", next)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    {OUTBOUND_TYPES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </ConfigField>
          </div>

          {form.type === "socks5" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <ConfigField
                label="socks5.addr"
                hint={t("hysteria.config.outbounds.socks5.addr")}
              >
                <Input
                  className="font-mono text-xs"
                  value={form.socks5?.addr ?? ""}
                  placeholder="127.0.0.1:1080"
                  onChange={(event) =>
                    update("socks5", {
                      addr: event.target.value,
                      username: form.socks5?.username,
                      password: form.socks5?.password,
                    })
                  }
                />
              </ConfigField>
              <ConfigField
                label="socks5.username"
                hint={t("hysteria.config.outbounds.socks5.username")}
                optional
              >
                <Input
                  value={form.socks5?.username ?? ""}
                  onChange={(event) =>
                    update("socks5", {
                      addr: form.socks5?.addr ?? "",
                      username: event.target.value,
                      password: form.socks5?.password,
                    })
                  }
                />
              </ConfigField>
              <ConfigField
                label="socks5.password"
                hint={t("hysteria.config.outbounds.socks5.password")}
                optional
              >
                <Input
                  type="password"
                  value={form.socks5?.password ?? ""}
                  onChange={(event) =>
                    update("socks5", {
                      addr: form.socks5?.addr ?? "",
                      username: form.socks5?.username,
                      password: event.target.value,
                    })
                  }
                />
              </ConfigField>
            </div>
          )}

          {form.type === "http" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <ConfigField
                label="http.url"
                hint={t("hysteria.config.outbounds.http.url")}
              >
                <Input
                  className="font-mono text-xs"
                  value={form.http?.url ?? ""}
                  placeholder="https://user:pass@host:port"
                  onChange={(event) =>
                    update("http", {
                      url: event.target.value,
                      insecure: Boolean(form.http?.insecure),
                    })
                  }
                />
              </ConfigField>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={Boolean(form.http?.insecure)}
                    onCheckedChange={(checked) =>
                      update("http", {
                        url: form.http?.url ?? "",
                        insecure: checked,
                      })
                    }
                  />
                  http.insecure
                </label>
              </div>
            </div>
          )}

          {form.type === "direct" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <ConfigField
                label="direct.mode"
                hint={t("hysteria.config.outbounds.direct.mode")}
              >
                <Select
                  value={form.direct?.mode ?? "auto"}
                  onValueChange={(next) =>
                    update("direct", {
                      mode: next,
                      bindIPv4: form.direct?.bindIPv4,
                      bindIPv6: form.direct?.bindIPv6,
                      bindDevice: form.direct?.bindDevice,
                      fastOpen: form.direct?.fastOpen,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {DIRECT_MODES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </ConfigField>
              <ConfigField
                label="direct.bindIPv4"
                hint={t("hysteria.config.outbounds.direct.bindIPv4")}
                optional
              >
                <Input
                  className="font-mono text-xs"
                  value={form.direct?.bindIPv4 ?? ""}
                  onChange={(event) =>
                    update("direct", {
                      mode: form.direct?.mode ?? "auto",
                      bindIPv4: event.target.value,
                      bindIPv6: form.direct?.bindIPv6,
                      bindDevice: form.direct?.bindDevice,
                      fastOpen: form.direct?.fastOpen,
                    })
                  }
                />
              </ConfigField>
              <ConfigField
                label="direct.bindIPv6"
                hint={t("hysteria.config.outbounds.direct.bindIPv6")}
                optional
              >
                <Input
                  className="font-mono text-xs"
                  value={form.direct?.bindIPv6 ?? ""}
                  onChange={(event) =>
                    update("direct", {
                      mode: form.direct?.mode ?? "auto",
                      bindIPv4: form.direct?.bindIPv4,
                      bindIPv6: event.target.value,
                      bindDevice: form.direct?.bindDevice,
                      fastOpen: form.direct?.fastOpen,
                    })
                  }
                />
              </ConfigField>
              <ConfigField
                label="direct.bindDevice"
                hint={t("hysteria.config.outbounds.direct.bindDevice")}
                optional
              >
                <Input
                  className="font-mono text-xs"
                  value={form.direct?.bindDevice ?? ""}
                  placeholder="eth0"
                  onChange={(event) =>
                    update("direct", {
                      mode: form.direct?.mode ?? "auto",
                      bindIPv4: form.direct?.bindIPv4,
                      bindIPv6: form.direct?.bindIPv6,
                      bindDevice: event.target.value,
                      fastOpen: form.direct?.fastOpen,
                    })
                  }
                />
              </ConfigField>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={Boolean(form.direct?.fastOpen)}
                    onCheckedChange={(checked) =>
                      update("direct", {
                        mode: form.direct?.mode ?? "auto",
                        bindIPv4: form.direct?.bindIPv4,
                        bindIPv6: form.direct?.bindIPv6,
                        bindDevice: form.direct?.bindDevice,
                        fastOpen: checked,
                      })
                    }
                  />
                  direct.fastOpen
                </label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submit}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("hysteria.outboundInfo")}</DialogTitle>
            <DialogDescription>{infoTarget?.name}</DialogDescription>
          </DialogHeader>

          {infoTarget && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">type</dt>
              <dd className="font-mono text-xs">{infoTarget.type}</dd>
              {infoTarget.type === "socks5" && (
                <>
                  <dt className="text-muted-foreground">socks5.addr</dt>
                  <dd className="font-mono text-xs">{infoTarget.socks5?.addr || "-"}</dd>
                  <dt className="text-muted-foreground">socks5.username</dt>
                  <dd className="font-mono text-xs">
                    {infoTarget.socks5?.username || "-"}
                  </dd>
                  <dt className="text-muted-foreground">socks5.password</dt>
                  <dd className="font-mono text-xs">
                    {infoTarget.socks5?.password ? "••••••" : "-"}
                  </dd>
                </>
              )}
              {infoTarget.type === "http" && (
                <>
                  <dt className="text-muted-foreground">http.url</dt>
                  <dd className="font-mono text-xs break-all">
                    {infoTarget.http?.url || "-"}
                  </dd>
                  <dt className="text-muted-foreground">http.insecure</dt>
                  <dd className="font-mono text-xs">
                    {String(infoTarget.http?.insecure ?? false)}
                  </dd>
                </>
              )}
              {infoTarget.type === "direct" && (
                <>
                  <dt className="text-muted-foreground">direct.mode</dt>
                  <dd className="font-mono text-xs">{infoTarget.direct?.mode || "-"}</dd>
                  <dt className="text-muted-foreground">direct.bindIPv4</dt>
                  <dd className="font-mono text-xs">
                    {infoTarget.direct?.bindIPv4 || "-"}
                  </dd>
                  <dt className="text-muted-foreground">direct.bindIPv6</dt>
                  <dd className="font-mono text-xs">
                    {infoTarget.direct?.bindIPv6 || "-"}
                  </dd>
                  <dt className="text-muted-foreground">direct.bindDevice</dt>
                  <dd className="font-mono text-xs">
                    {infoTarget.direct?.bindDevice || "-"}
                  </dd>
                  <dt className="text-muted-foreground">direct.fastOpen</dt>
                  <dd className="font-mono text-xs">
                    {String(infoTarget.direct?.fastOpen ?? false)}
                  </dd>
                </>
              )}
            </dl>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInfoOpen(false)}>
              {t("common.close")}
            </Button>
            {infoTarget && (
              <Button
                variant="destructive"
                onClick={() => {
                  remove(infoTarget.name);
                  setInfoOpen(false);
                  toast.success(t("common.success"));
                }}
              >
                {t("common.remove")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
