import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  CalendarClockIcon,
  LaptopIcon,
  LinkIcon,
  QrCodeIcon,
  RefreshCwIcon,
  Share2Icon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  TimerIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getAccountApi, verifyDefaultPassApi } from "@/api/account";
import { hysteria2SubscribeUrlApi, hysteria2UrlApi } from "@/api/hysteria2";
import { QrCodeDialog } from "@/components/common/qr-code-dialog";
import { StatCard, TinyBadge } from "@/components/common/stat-card";
import { LogoMark } from "@/components/logo";
import { PageHeader } from "@/components/page-header";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth";
import { useI18n } from "@/i18n";
import { copyText } from "@/lib/io";
import {
  formatBytes,
  formatDateTimeValue,
  formatStorageUnit,
  timestampToDateTime,
} from "@/lib/format";
import type { AccountVo } from "@/types/api";

interface QrState {
  open: boolean;
  title: string;
  src: string;
}

const EMPTY_QR: QrState = { open: false, title: "", src: "" };

export function DashboardPage() {
  const { t } = useI18n();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [account, setAccount] = useState<AccountVo | null>(null);
  const [qr, setQr] = useState<QrState>(EMPTY_QR);
  const [defaultPassword, setDefaultPassword] = useState(false);

  const loadAccount = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getAccountApi({ id: user.id });
      setAccount(data);
    } catch {
      /* toast handled by the API layer */
    }
  }, [user]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    if (!isAdmin) return;
    verifyDefaultPassApi()
      .then(setDefaultPassword)
      .catch(() => setDefaultPassword(false));
  }, [isAdmin]);

  const greeting = () => {
    const hours = new Date().getHours();
    const name = account?.username ?? user?.username ?? "";
    if (hours >= 6 && hours < 8) return t("info.greeting1");
    if (hours >= 8 && hours < 12) return `${t("info.greeting2")}${name}`;
    if (hours >= 12 && hours < 18) return `${t("info.greeting3")}${name}`;
    if (hours >= 18 && hours < 24) return `${t("info.greeting4")}${name}`;
    return t("info.greeting5");
  };

  const copy = async (text: string) => {
    const ok = await copyText(text);
    if (ok) toast.success(t("common.copySuccess"));
    else toast.error(t("common.copyFailed"));
  };

  const handleSubscribe = async () => {
    if (!user) return;
    try {
      const data = await hysteria2SubscribeUrlApi({
        accountId: user.id,
        protocol: window.location.protocol,
        host: window.location.host,
      });
      await copy(data.url);
    } catch {
      /* handled globally */
    }
  };

  const handleSubscribeQr = async () => {
    if (!user) return;
    try {
      const data = await hysteria2SubscribeUrlApi({
        accountId: user.id,
        protocol: window.location.protocol,
        host: window.location.host,
      });
      setQr({
        open: true,
        title: t("dashboard.qrSubscribeTitle"),
        src: `data:image/png;base64,${data.qrCode}`,
      });
    } catch {
      /* handled globally */
    }
  };

  const handleNodeUrl = async () => {
    if (!user) return;
    try {
      const data = await hysteria2UrlApi({
        accountId: user.id,
        hostname: window.location.hostname,
      });
      await copy(data.url);
    } catch {
      /* handled globally */
    }
  };

  const handleNodeQr = async () => {
    if (!user) return;
    try {
      const data = await hysteria2UrlApi({
        accountId: user.id,
        hostname: window.location.hostname,
      });
      setQr({
        open: true,
        title: t("dashboard.qrNodeTitle"),
        src: `data:image/png;base64,${data.qrCode}`,
      });
    } catch {
      /* handled globally */
    }
  };

  const quota = account?.quota ?? 0;
  const used = (account?.download ?? 0) + (account?.upload ?? 0);
  const unlimited = quota === -1;
  const usagePercent = !unlimited && quota > 0 ? (used / quota) * 100 : undefined;
  const remaining = unlimited ? -1 : Math.max(quota - used, 0);
  const insecure = window.location.protocol !== "https:";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.description")}
        actions={
          <Button variant="outline" size="sm" onClick={() => void loadAccount()}>
            <RefreshCwIcon data-icon="inline-start" />
            {t("common.refresh")}
          </Button>
        }
      />

      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-primary/8 blur-3xl" />
        <CardHeader>
          <CardTitle className="text-base font-medium text-muted-foreground">
            {t("dashboard.greeting")}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              {account?.role ?? (isAdmin ? "admin" : "user")}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <LogoMark className="size-14 rounded-2xl" />
              <div className="flex flex-col gap-1">
                <p className="text-lg font-medium text-balance">{greeting()}</p>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.memberSince", {
                    date: formatDateTimeValue(account?.createTime),
                  })}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => void handleSubscribe()}>
                <Share2Icon data-icon="inline-start" />
                {t("common.subscribe")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleSubscribeQr()}
              >
                <QrCodeIcon data-icon="inline-start" />
                {t("common.subscribeQrCode")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleNodeUrl()}
              >
                <LinkIcon data-icon="inline-start" />
                {t("common.nodeUrl")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleNodeQr()}
              >
                <QrCodeIcon data-icon="inline-start" />
                {t("common.nodeQrCode")}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <LaptopIcon className="size-4" />
              </span>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">
                  {t("dashboard.activeSessions")}
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {account?.device ?? 0} / {account?.deviceNo ?? "—"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <TimerIcon className="size-4" />
              </span>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">
                  {t("dashboard.lastConnection")}
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {account?.conAt
                    ? timestampToDateTime(account.conAt)
                    : t("dashboard.noConnectionYet")}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CalendarClockIcon className="size-4" />
              </span>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">
                  {t("account.expireTime")}
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {timestampToDateTime(account?.expireTime)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (defaultPassword || insecure) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {defaultPassword && (
            <Alert>
              <ShieldAlertIcon />
              <AlertTitle>{t("dashboard.defaultPassTitle")}</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2.5">
                <span>{t("dashboard.defaultPassDescription")}</span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => navigate("/account/list?focus=change-pass")}
                >
                  {t("dashboard.fixPassword")}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {insecure && (
            <Alert>
              <ShieldCheckIcon />
              <AlertTitle>{t("dashboard.noHttpsTitle")}</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2.5">
                <span>{t("dashboard.noHttpsDescription")}</span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => navigate("/config/list?focus=huiHttps")}
                >
                  {t("dashboard.enableHttps")}
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("account.quota")}
          icon={ShieldCheckIcon}
          value={
            unlimited ? t("common.unlimited") : formatBytes(quota)
          }
          badge={
            <TinyBadge>{unlimited ? "∞" : formatStorageUnit(quota)}</TinyBadge>
          }
          progress={usagePercent}
          hint={
            unlimited
              ? t("dashboard.quotaNoLimit")
              : `${t("dashboard.used")} ${formatBytes(used)}${
                  usagePercent !== undefined
                    ? ` · ${t("dashboard.usedPercent", {
                        percent: usagePercent.toFixed(1),
                      })}`
                    : ""
                }`
          }
        />
        <StatCard
          label={t("account.download")}
          icon={ArrowDownToLineIcon}
          value={formatBytes(account?.download ?? 0)}
          badge={<TinyBadge>{formatStorageUnit(account?.download ?? 0)}</TinyBadge>}
          hint={
            unlimited
              ? t("dashboard.quotaNoLimit")
              : `${t("dashboard.remaining")} ${formatBytes(remaining)}`
          }
        />
        <StatCard
          label={t("account.upload")}
          icon={ArrowUpFromLineIcon}
          value={formatBytes(account?.upload ?? 0)}
          badge={<TinyBadge>{formatStorageUnit(account?.upload ?? 0)}</TinyBadge>}
          hint={`${t("dashboard.used")} ${formatBytes(used)}`}
        />
        <StatCard
          label={t("account.expireTime")}
          icon={CalendarClockIcon}
          value={
            account?.expireTime
              ? timestampToDateTime(account.expireTime)
              : "—"
          }
          hint={
            account?.kickUtilTime && account.kickUtilTime > Date.now()
              ? t("account.kickUtilTimeLast")
              : undefined
          }
        />
      </div>

      <QrCodeDialog
        open={qr.open}
        onOpenChange={(open) => setQr((prev) => ({ ...prev, open }))}
        title={qr.title}
        src={qr.src}
      />
    </div>
  );
}
