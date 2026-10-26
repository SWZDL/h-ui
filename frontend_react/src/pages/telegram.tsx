import { EyeIcon, EyeOffIcon, InfoIcon, SaveIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";
import { listConfigApi, updateConfigsApi } from "@/api/config";
import { ConfigField } from "@/components/common/config-field";
import { LoadingState } from "@/components/common/states";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { TELEGRAM_CONFIG_KEYS } from "@/lib/hysteria";

interface TelegramForm {
  enable: string;
  token: string;
  chatId: string;
  loginJobEnable: string;
  loginJobText: string;
}

interface TelegramErrors {
  token?: string;
  loginJobText?: string;
}

const EMPTY_FORM: TelegramForm = {
  enable: "0",
  token: "",
  chatId: "",
  loginJobEnable: "0",
  loginJobText: "",
};

const CONFIG_KEYS: string[] = [
  TELEGRAM_CONFIG_KEYS.enable,
  TELEGRAM_CONFIG_KEYS.token,
  TELEGRAM_CONFIG_KEYS.chatId,
  TELEGRAM_CONFIG_KEYS.loginJobEnable,
  TELEGRAM_CONFIG_KEYS.loginJobText,
];

function isErrorField(field: keyof TelegramForm): field is keyof TelegramErrors {
  return field === "token" || field === "loginJobText";
}

export function TelegramPage() {
  const { t } = useI18n();

  const [form, setForm] = useState<TelegramForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<TelegramErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);

  const enabled = form.enable === "1";
  const loginJobEnabled = form.loginJobEnable === "1";

  const setField = <K extends keyof TelegramForm>(
    field: K,
    value: TelegramForm[K]
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await listConfigApi({ keys: CONFIG_KEYS })) ?? [];
      const values = new Map<string, string>();
      for (const item of data) {
        values.set(item.key, item.value ?? "");
      }

      setForm({
        enable: values.get(TELEGRAM_CONFIG_KEYS.enable) || "0",
        token: values.get(TELEGRAM_CONFIG_KEYS.token) ?? "",
        chatId: values.get(TELEGRAM_CONFIG_KEYS.chatId) ?? "",
        loginJobEnable:
          values.get(TELEGRAM_CONFIG_KEYS.loginJobEnable) || "0",
        loginJobText: values.get(TELEGRAM_CONFIG_KEYS.loginJobText) ?? "",
      });
      setErrors({});
    } catch {
      /* the API layer already surfaced the error as a toast */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (saving) return;

    const next: TelegramErrors = {};
    if (enabled && !form.token.trim()) {
      next.token = t("common.required");
    }
    if (loginJobEnabled && !form.loginJobText.trim()) {
      next.loginJobText = t("common.required");
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await updateConfigsApi({
        configUpdateDtos: [
          { key: TELEGRAM_CONFIG_KEYS.enable, value: form.enable },
          { key: TELEGRAM_CONFIG_KEYS.token, value: form.token.trim() },
          { key: TELEGRAM_CONFIG_KEYS.chatId, value: form.chatId.trim() },
          {
            key: TELEGRAM_CONFIG_KEYS.loginJobEnable,
            value: form.loginJobEnable,
          },
          {
            key: TELEGRAM_CONFIG_KEYS.loginJobText,
            value: form.loginJobText,
          },
        ],
      });
      toast.success(t("common.success"));
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("telegram.title")}
        description={t("telegram.description")}
        actions={
          <Button
            size="sm"
            type="submit"
            form="telegram-config-form"
            disabled={saving || loading}
          >
            {saving ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SaveIcon data-icon="inline-start" />
            )}
            {t("common.save")}
          </Button>
        }
      />

      <Card className="max-w-3xl">
        <CardContent>
          {loading ? (
            <LoadingState />
          ) : (
            <form
              id="telegram-config-form"
              className="flex flex-col gap-6"
              noValidate
              aria-busy={saving}
              onSubmit={handleSubmit}
            >
              <FieldGroup>
                <Field orientation="horizontal">
                  <FieldLabel
                    htmlFor="telegram-enable"
                    className="font-mono text-xs"
                  >
                    {t("telegram.telegramEnable")}
                  </FieldLabel>
                  <div className="flex items-center gap-2">
                    <Badge variant={enabled ? "secondary" : "outline"}>
                      {enabled ? t("telegram.enable") : t("telegram.disable")}
                    </Badge>
                    <Switch
                      id="telegram-enable"
                      checked={enabled}
                      onCheckedChange={(checked) => {
                        setField("enable", checked ? "1" : "0");
                        if (!checked) {
                          setErrors((prev) => ({
                            ...prev,
                            token: undefined,
                          }));
                        }
                      }}
                    />
                  </div>
                </Field>

                <ConfigField
                  label={t("telegram.telegramToken")}
                  hint={t("telegram.tokenHint")}
                  htmlFor="telegram-token"
                  required={enabled}
                  error={errors.token}
                >
                  <InputGroup>
                    <InputGroupInput
                      id="telegram-token"
                      name="telegramToken"
                      type={tokenVisible ? "text" : "password"}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={t("telegram.tokenPlaceholder")}
                      value={form.token}
                      required={enabled}
                      aria-invalid={Boolean(errors.token)}
                      onChange={(event) =>
                        setField("token", event.target.value)
                      }
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size="icon-xs"
                        aria-label={t("telegram.telegramToken")}
                        aria-pressed={tokenVisible}
                        onClick={() => setTokenVisible((prev) => !prev)}
                      >
                        {tokenVisible ? <EyeOffIcon /> : <EyeIcon />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </ConfigField>

                <ConfigField
                  label={t("telegram.telegramChatId")}
                  hint={t("telegram.chatIdHint")}
                  htmlFor="telegram-chat-id"
                >
                  <Input
                    id="telegram-chat-id"
                    name="telegramChatId"
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono"
                    placeholder={t("telegram.chatIdPlaceholder")}
                    value={form.chatId}
                    onChange={(event) =>
                      setField("chatId", event.target.value)
                    }
                  />
                </ConfigField>

                <Separator />

                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel
                      htmlFor="telegram-login-job-enable"
                      className="font-mono text-xs"
                    >
                      {t("telegram.telegramLoginJobEnable")}
                    </FieldLabel>
                    <FieldDescription>
                      {t("telegram.telegramLoginJob")}
                    </FieldDescription>
                  </FieldContent>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={loginJobEnabled ? "secondary" : "outline"}
                    >
                      {loginJobEnabled
                        ? t("telegram.enable")
                        : t("telegram.disable")}
                    </Badge>
                    <Switch
                      id="telegram-login-job-enable"
                      checked={loginJobEnabled}
                      onCheckedChange={(checked) => {
                        setField("loginJobEnable", checked ? "1" : "0");
                        if (!checked) {
                          setErrors((prev) => ({
                            ...prev,
                            loginJobText: undefined,
                          }));
                        }
                      }}
                    />
                  </div>
                </Field>

                <ConfigField
                  label={t("telegram.telegramLoginJobText")}
                  hint={t("telegram.loginJobHint")}
                  htmlFor="telegram-login-job-text"
                  required={loginJobEnabled}
                  error={errors.loginJobText}
                >
                  <Textarea
                    id="telegram-login-job-text"
                    name="telegramLoginJobText"
                    rows={5}
                    spellCheck={false}
                    className="min-h-28 font-mono text-xs"
                    placeholder={t("telegram.jobTextPlaceholder")}
                    value={form.loginJobText}
                    required={loginJobEnabled}
                    aria-invalid={Boolean(errors.loginJobText)}
                    onChange={(event) =>
                      setField("loginJobText", event.target.value)
                    }
                  />
                </ConfigField>

                <Alert className="bg-muted/40">
                  <InfoIcon />
                  <AlertTitle>{t("telegram.placeholders")}</AlertTitle>
                  <AlertDescription>
                    <ul className="flex flex-col gap-1 font-mono text-xs">
                      <li>{t("telegram.placeholderTime")}</li>
                      <li>{t("telegram.placeholderUsername")}</li>
                      <li>{t("telegram.placeholderIp")}</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
