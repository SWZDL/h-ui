import {
  BanIcon,
  CheckIcon,
  DownloadIcon,
  LinkIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  QrCodeIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  Share2Icon,
  Trash2Icon,
  UnlockIcon,
  UploadIcon,
  UsersRoundIcon,
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
  deleteAccountApi,
  exportAccountApi,
  getAccountApi,
  importAccountApi,
  pageAccountApi,
  releaseKickAccountApi,
  resetTrafficApi,
  saveAccountApi,
  updateAccountApi,
} from "@/api/account";
import {
  hysteria2KickApi,
  hysteria2SubscribeUrlApi,
  hysteria2UrlApi,
} from "@/api/hysteria2";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DataPagination } from "@/components/common/data-pagination";
import { QrCodeDialog } from "@/components/common/qr-code-dialog";
import { EmptyState } from "@/components/common/states";
import { TinyBadge } from "@/components/common/stat-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import {
  UNITS,
  calculateBytes,
  formatBytes,
  formatDateTimeValue,
  formatRemaining,
  formatStorageCapacity,
  formatStorageUnit,
  fromDateTimeLocal,
  getDayLater,
  getHourLater,
  getMonthLater,
  getWeekLater,
  getYearLater,
  timestampToDateTime,
  toDateTimeLocal,
} from "@/lib/format";
import { copyText, downloadResponse, validateFile } from "@/lib/io";
import { cn } from "@/lib/utils";
import type { AccountPageDto, AccountVo } from "@/types/api";

const CREDENTIAL_PATTERN = /^[a-zA-Z0-9!@#$%^&*()_+-=]{6,32}$/;
const PAGE_SIZES = [10, 20, 30, 50];
const REMARK_MAX_LENGTH = 50;
const SKELETON_ROWS = 5;

/** Timestamps that are secondary information on narrow screens. */
const SECONDARY_COLUMNS = new Set([12, 14]);
const secondaryColumnClass = (index: number) =>
  SECONDARY_COLUMNS.has(index) ? "hidden 2xl:table-cell" : undefined;

type RowCommand =
  | "subscribe"
  | "nodeUrl"
  | "nodeQr"
  | "resetTraffic"
  | "edit"
  | "delete"
  | "kick"
  | "release";

interface AccountFilters {
  remark: string;
  username: string;
  deleted?: string;
}

const EMPTY_FILTERS: AccountFilters = { remark: "", username: "" };

type ConfirmKind = "delete" | "resetTraffic" | "release";

interface ConfirmState {
  kind: ConfirmKind | null;
  row: AccountVo | null;
}

interface KickState {
  open: boolean;
  row: AccountVo | null;
  time: string;
}

interface QrState {
  open: boolean;
  src: string;
}

const FORM_FIELDS = [
  "username",
  "pass",
  "conPass",
  "expireTime",
  "deviceNo",
] as const;

type FormFieldName = (typeof FORM_FIELDS)[number];
type FormErrors = Partial<Record<FormFieldName, string>>;

interface AccountFormState {
  remark: string;
  username: string;
  pass: string;
  conPass: string;
  capacity: string;
  unit: string;
  deviceNo: string;
  expireTime: string;
  deleted: string;
}

function isFormField(value: string): value is FormFieldName {
  return (FORM_FIELDS as readonly string[]).includes(value);
}

function createEmptyForm(): AccountFormState {
  return {
    remark: "",
    username: "",
    pass: "",
    conPass: "",
    capacity: "0",
    unit: "GB",
    deviceNo: "6",
    expireTime: toDateTimeLocal(getMonthLater()),
    deleted: "0",
  };
}

function createFormFromAccount(account: AccountVo): AccountFormState {
  return {
    remark: account.remark ?? "",
    username: account.username ?? "",
    pass: "",
    conPass: "",
    capacity: String(formatStorageCapacity(account.quota)),
    unit: formatStorageUnit(account.quota),
    deviceNo: String(account.deviceNo),
    expireTime: toDateTimeLocal(account.expireTime),
    deleted: String(account.deleted),
  };
}

/* ------------------------------------------------------------------ badges */

function OnlineBadge({ online }: { online: boolean }) {
  const { t } = useI18n();

  return (
    <Badge
      variant={online ? "secondary" : "outline"}
      className={cn("gap-1.5", !online && "text-muted-foreground")}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          online ? "bg-primary" : "bg-muted-foreground/50"
        )}
      />
      {online ? t("account.online") : t("account.offline")}
    </Badge>
  );
}

function AccountStateBadge({ deleted }: { deleted: number }) {
  const { t } = useI18n();
  const enabled = deleted === 0;

  return (
    <Badge
      variant={enabled ? "secondary" : "outline"}
      className={cn(!enabled && "text-muted-foreground")}
    >
      {enabled ? t("common.enable") : t("common.disable")}
    </Badge>
  );
}

/* ----------------------------------------------------------------- actions */

interface AccountActionsProps {
  row: AccountVo;
  onCommand: (command: RowCommand, row: AccountVo) => void;
}

function AccountActions({ row, onCommand }: AccountActionsProps) {
  const { t } = useI18n();
  const kicked = row.kickUtilTime > Date.now();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label={`${t("common.actions")} · ${row.username}`}
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onCommand("subscribe", row)}>
            <Share2Icon />
            {t("common.subscribe")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCommand("nodeUrl", row)}>
            <LinkIcon />
            {t("common.nodeUrl")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCommand("nodeQr", row)}>
            <QrCodeIcon />
            {t("common.nodeQrCode")}
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onCommand("resetTraffic", row)}>
            <RotateCcwIcon />
            {t("common.resetTraffic")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCommand("edit", row)}>
            <PencilIcon />
            {t("common.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCommand("kick", row)}>
            <BanIcon />
            {t("account.kick")}
          </DropdownMenuItem>
          {kicked && (
            <DropdownMenuItem onSelect={() => onCommand("release", row)}>
              <UnlockIcon />
              {t("account.releaseKick")}
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onSelect={() => onCommand("delete", row)}
        >
          <Trash2Icon />
          {t("common.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* --------------------------------------------------------------- table row */

interface AccountRowProps {
  row: AccountVo;
  onCommand: (command: RowCommand, row: AccountVo) => void;
}

function AccountRow({ row, onCommand }: AccountRowProps) {
  const { t } = useI18n();

  /* Quota `-1` is unlimited; never expose the legacy "Unlimited" literal. */
  const quotaLabel =
    row.quota === -1 ? t("common.unlimited") : formatBytes(row.quota);

  const remainingLabels = {
    days: t("common.days"),
    hours: t("common.hours"),
    minutes: t("common.minutes"),
    seconds: t("common.seconds"),
  };

  const kickRemaining =
    row.kickUtilTime > Date.now()
      ? formatRemaining(row.kickUtilTime, remainingLabels) || "-"
      : "-";

  return (
    <TableRow className="group/row">
      <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
        {row.id}
      </TableCell>
      <TableCell>
        <span
          className="block max-w-40 truncate"
          title={row.remark || undefined}
        >
          {row.remark || "-"}
        </span>
      </TableCell>
      <TableCell className="font-medium">{row.username}</TableCell>
      <TableCell>
        {row.role ? (
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            {row.role}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <span className="tabular-nums">{quotaLabel}</span>
          {row.quota === -1 && <TinyBadge>∞</TinyBadge>}
          {row.quota > 0 && (
            <TinyBadge>{formatStorageUnit(row.quota)}</TinyBadge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground tabular-nums">
        {formatBytes(row.download)}
      </TableCell>
      <TableCell className="text-muted-foreground tabular-nums">
        {formatBytes(row.upload)}
      </TableCell>
      <TableCell>
        <OnlineBadge online={row.online} />
      </TableCell>
      <TableCell className="tabular-nums">{row.device}</TableCell>
      <TableCell className="tabular-nums">{row.deviceNo}</TableCell>
      <TableCell className="tabular-nums">{kickRemaining}</TableCell>
      <TableCell className="tabular-nums">
        {timestampToDateTime(row.expireTime)}
      </TableCell>
      <TableCell className="hidden tabular-nums 2xl:table-cell">
        {row.loginAt ? timestampToDateTime(row.loginAt) : "-"}
      </TableCell>
      <TableCell className="tabular-nums">
        {row.conAt ? timestampToDateTime(row.conAt) : "-"}
      </TableCell>
      <TableCell className="hidden tabular-nums 2xl:table-cell">
        {formatDateTimeValue(row.createTime)}
      </TableCell>
      <TableCell>
        <AccountStateBadge deleted={row.deleted} />
      </TableCell>
      <TableCell className="sticky right-0 z-10 border-l bg-card text-right shadow-[-10px_0_14px_-14px_rgba(0,0,0,0.35)]">
        <AccountActions row={row} onCommand={onCommand} />
      </TableCell>
    </TableRow>
  );
}

/* ------------------------------------------------------------- account form */

interface AccountFormDialogProps {
  open: boolean;
  account: AccountVo | null;
  focusPassword: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function AccountFormDialog({
  open,
  account,
  focusPassword,
  onOpenChange,
  onSaved,
}: AccountFormDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {account ? t("accounts.editTitle") : t("accounts.addTitle")}
          </DialogTitle>
          <DialogDescription>{t("login.usernameRule")}</DialogDescription>
        </DialogHeader>

        {/* Remounted whenever the dialog content mounts, so the form always
            starts from the account that was selected. */}
        <AccountFormBody
          key={account?.id ?? "new"}
          account={account}
          focusPassword={focusPassword}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

interface AccountFormBodyProps {
  account: AccountVo | null;
  focusPassword: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function AccountFormBody({
  account,
  focusPassword,
  onClose,
  onSaved,
}: AccountFormBodyProps) {
  const { t } = useI18n();
  const isEdit = account !== null;
  const passRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<AccountFormState>(() =>
    account ? createFormFromAccount(account) : createEmptyForm()
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!focusPassword) return;
    const timer = window.setTimeout(() => passRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [focusPassword]);

  const setField = <K extends keyof AccountFormState>(
    field: K,
    value: AccountFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));

    if (isFormField(field)) {
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const username = form.username.trim();

    if (!isEdit) {
      if (!username) next.username = t("common.required");
      else if (!CREDENTIAL_PATTERN.test(username)) {
        next.username = t("login.usernameRule");
      }
    } else if (username && !CREDENTIAL_PATTERN.test(username)) {
      next.username = t("login.usernameRule");
    }

    if (!isEdit) {
      if (!form.pass) next.pass = t("common.required");
      else if (!CREDENTIAL_PATTERN.test(form.pass)) {
        next.pass = t("login.passwordRule");
      }
      if (!form.conPass) next.conPass = t("common.required");
      else if (!CREDENTIAL_PATTERN.test(form.conPass)) {
        next.conPass = t("login.passwordRule");
      }
    } else {
      if (form.pass && !CREDENTIAL_PATTERN.test(form.pass)) {
        next.pass = t("login.passwordRule");
      }
      if (form.conPass && !CREDENTIAL_PATTERN.test(form.conPass)) {
        next.conPass = t("login.passwordRule");
      }
    }

    if (!form.expireTime || fromDateTimeLocal(form.expireTime) <= 0) {
      next.expireTime = t("common.required");
    }

    const deviceNo = Number(form.deviceNo);
    if (!form.deviceNo.trim() || !Number.isFinite(deviceNo) || deviceNo < 1) {
      next.deviceNo = `${t("account.deviceNo")} ≥ 1`;
    }

    return next;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const quotaBytes = calculateBytes(Number(form.capacity) || 0, form.unit);
    const payload = {
      remark: form.remark.trim(),
      username: form.username.trim(),
      pass: form.pass,
      conPass: form.conPass,
      quota: quotaBytes,
      expireTime: fromDateTimeLocal(form.expireTime),
      deviceNo: Number(form.deviceNo),
      deleted: form.deleted === "1" ? 1 : 0,
    };

    setSaving(true);
    try {
      if (account) await updateAccountApi({ id: account.id, ...payload });
      else await saveAccountApi(payload);
      toast.success(t("common.success"));
      onSaved();
      onClose();
    } catch {
      /* toast handled by the API layer */
    } finally {
      setSaving(false);
    }
  };

  const quotaBytes = calculateBytes(Number(form.capacity) || 0, form.unit);
  const quotaPreview =
    quotaBytes === -1 ? t("common.unlimited") : formatBytes(quotaBytes);

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="account-remark">{t("account.remark")}</FieldLabel>
          <Input
            id="account-remark"
            value={form.remark}
            maxLength={REMARK_MAX_LENGTH}
            placeholder={t("account.remark")}
            onChange={(event) => setField("remark", event.target.value)}
          />
        </Field>

        <Field data-invalid={Boolean(errors.username)}>
          <FieldLabel htmlFor="account-username">
            {t("account.username")}
          </FieldLabel>
          <Input
            id="account-username"
            autoComplete="off"
            value={form.username}
            aria-invalid={Boolean(errors.username)}
            placeholder={isEdit ? t("common.optional") : t("account.username")}
            onChange={(event) => setField("username", event.target.value)}
          />
          {errors.username && <FieldError>{errors.username}</FieldError>}
        </Field>

        <Field data-invalid={Boolean(errors.pass)}>
          <FieldLabel htmlFor="account-pass">{t("account.pass")}</FieldLabel>
          <Input
            id="account-pass"
            ref={passRef}
            type="password"
            autoComplete="new-password"
            value={form.pass}
            aria-invalid={Boolean(errors.pass)}
            placeholder={isEdit ? t("common.optional") : t("account.pass")}
            onChange={(event) => setField("pass", event.target.value)}
          />
          {errors.pass && <FieldError>{errors.pass}</FieldError>}
        </Field>

        <Field data-invalid={Boolean(errors.conPass)}>
          <FieldLabel htmlFor="account-con-pass">
            {t("account.conPass")}
          </FieldLabel>
          <Input
            id="account-con-pass"
            type="password"
            autoComplete="new-password"
            value={form.conPass}
            aria-invalid={Boolean(errors.conPass)}
            placeholder={isEdit ? t("common.optional") : t("account.conPass")}
            onChange={(event) => setField("conPass", event.target.value)}
          />
          {errors.conPass && <FieldError>{errors.conPass}</FieldError>}
        </Field>

        <Field data-invalid={Boolean(errors.deviceNo)}>
          <FieldLabel htmlFor="account-device-no">
            {t("account.deviceNo")}
          </FieldLabel>
          <Input
            id="account-device-no"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={form.deviceNo}
            aria-invalid={Boolean(errors.deviceNo)}
            onChange={(event) => setField("deviceNo", event.target.value)}
          />
          {errors.deviceNo && <FieldError>{errors.deviceNo}</FieldError>}
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="account-quota">{t("account.quota")}</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="account-quota"
              type="number"
              min={-1}
              step="any"
              inputMode="numeric"
              value={form.capacity}
              className="max-w-40"
              onChange={(event) => setField("capacity", event.target.value)}
            />
            <Select
              value={form.unit}
              onValueChange={(value) => setField("unit", value)}
            >
              <SelectTrigger className="w-28" aria-label={t("account.unit")}>
                <SelectValue placeholder={t("account.unit")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground tabular-nums">
              {quotaPreview}
            </span>
          </div>
          <FieldDescription>{`${t("common.unlimited")} = -1`}</FieldDescription>
        </Field>

        <Field className="sm:col-span-2" data-invalid={Boolean(errors.expireTime)}>
          <FieldLabel htmlFor="account-expire-time">
            {t("account.expireTime")}
          </FieldLabel>
          <Input
            id="account-expire-time"
            type="datetime-local"
            value={form.expireTime}
            aria-invalid={Boolean(errors.expireTime)}
            onChange={(event) => setField("expireTime", event.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: `+7${t("common.days")}`, get: getWeekLater },
              { label: "+1M", get: getMonthLater },
              { label: "+1Y", get: getYearLater },
            ].map((shortcut) => (
              <Button
                key={shortcut.label}
                type="button"
                variant="outline"
                size="xs"
                title={timestampToDateTime(shortcut.get())}
                aria-label={`${t("account.expireTime")} ${timestampToDateTime(
                  shortcut.get()
                )}`}
                onClick={() =>
                  setField("expireTime", toDateTimeLocal(shortcut.get()))
                }
              >
                {shortcut.label}
              </Button>
            ))}
          </div>
          {errors.expireTime && <FieldError>{errors.expireTime}</FieldError>}
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel>{t("common.deleted")}</FieldLabel>
          <RadioGroup
            value={form.deleted}
            className="flex flex-wrap gap-4"
            onValueChange={(value) => setField("deleted", value)}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id="account-state-enabled" value="0" />
              <Label
                htmlFor="account-state-enabled"
                className="font-normal"
              >
                {t("common.enable")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem id="account-state-disabled" value="1" />
              <Label
                htmlFor="account-state-disabled"
                className="font-normal"
              >
                {t("common.disable")}
              </Label>
            </div>
          </RadioGroup>
        </Field>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={onClose}
        >
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner /> : <CheckIcon data-icon="inline-start" />}
          {t("common.confirm")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* -------------------------------------------------------------------- page */

export function AccountsPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState<AccountFilters>(EMPTY_FILTERS);
  const [query, setQuery] = useState<AccountFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [reloadToken, setReloadToken] = useState(0);

  const [records, setRecords] = useState<AccountVo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [editor, setEditor] = useState<{
    open: boolean;
    account: AccountVo | null;
    focusPassword: boolean;
  }>({ open: false, account: null, focusPassword: false });

  const [confirm, setConfirm] = useState<ConfirmState>({
    kind: null,
    row: null,
  });
  const [kick, setKick] = useState<KickState>({
    open: false,
    row: null,
    time: "",
  });
  const [kickSaving, setKickSaving] = useState(false);
  const [qr, setQr] = useState<QrState>({ open: false, src: "" });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const deepLinkRef = useRef(false);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    const params: AccountPageDto = {
      pageNum: page,
      pageSize,
      remark: query.remark || undefined,
      username: query.username || undefined,
      deleted: query.deleted,
    };

    try {
      const data = await pageAccountApi(params);
      if (requestId !== requestIdRef.current) return;
      setRecords(data.records ?? []);
      setTotal(data.total ?? 0);
    } catch {
      /* toast handled by the API layer */
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [page, pageSize, query, reloadToken]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Deep link from the dashboard security alert: edit the default admin. */
  useEffect(() => {
    if (deepLinkRef.current) return;
    if (searchParams.get("focus") !== "change-pass") return;
    deepLinkRef.current = true;

    getAccountApi({ id: 1 })
      .then((account) =>
        setEditor({ open: true, account, focusPassword: true })
      )
      .catch(() => {
        /* toast handled by the API layer */
      });
  }, [searchParams]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuery({ ...filters });
    setPage(1);
    reload();
  };

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setQuery(EMPTY_FILTERS);
    setPage(1);
    reload();
  };

  const openCreate = () => {
    setEditor({ open: true, account: null, focusPassword: false });
  };

  const openEdit = async (row: AccountVo) => {
    try {
      const account = await getAccountApi({ id: row.id });
      setEditor({ open: true, account, focusPassword: false });
    } catch {
      /* toast handled by the API layer */
    }
  };

  const copyWithToast = async (text: string) => {
    const ok = await copyText(text);
    if (ok) toast.success(t("common.copySuccess"));
    else toast.error(t("common.copyFailed"));
  };

  const copySubscribeUrl = async (row: AccountVo) => {
    try {
      const data = await hysteria2SubscribeUrlApi({
        accountId: row.id,
        protocol: window.location.protocol,
        host: window.location.host,
      });
      await copyWithToast(data.url);
    } catch {
      /* toast handled by the API layer */
    }
  };

  const copyNodeUrl = async (row: AccountVo) => {
    try {
      const data = await hysteria2UrlApi({
        accountId: row.id,
        hostname: window.location.hostname,
      });
      await copyWithToast(data.url);
    } catch {
      /* toast handled by the API layer */
    }
  };

  const showNodeQr = async (row: AccountVo) => {
    try {
      const data = await hysteria2UrlApi({
        accountId: row.id,
        hostname: window.location.hostname,
      });
      setQr({ open: true, src: `data:image/png;base64,${data.qrCode}` });
    } catch {
      /* toast handled by the API layer */
    }
  };

  const openKick = (row: AccountVo) => {
    const base =
      row.kickUtilTime > Date.now() ? row.kickUtilTime : getHourLater();
    setKick({ open: true, row, time: toDateTimeLocal(base) });
  };

  const handleRowCommand = (command: RowCommand, row: AccountVo) => {
    switch (command) {
      case "subscribe":
        void copySubscribeUrl(row);
        break;
      case "nodeUrl":
        void copyNodeUrl(row);
        break;
      case "nodeQr":
        void showNodeQr(row);
        break;
      case "resetTraffic":
        setConfirm({ kind: "resetTraffic", row });
        break;
      case "edit":
        void openEdit(row);
        break;
      case "delete":
        setConfirm({ kind: "delete", row });
        break;
      case "kick":
        openKick(row);
        break;
      case "release":
        setConfirm({ kind: "release", row });
        break;
    }
  };

  const handleExport = async () => {
    try {
      const response = await exportAccountApi();
      downloadResponse(response, "accounts.json");
      toast.success(t("common.downloadStarted"));
    } catch {
      /* toast handled by the API layer */
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const error = validateFile(file, { extensions: [".json"], maxSizeMb: 2 });
    if (error) {
      toast.error(error);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      await importAccountApi(formData);
      toast.success(t("common.success"));
      await load();
    } catch {
      /* toast handled by the API layer */
    }
  };

  const runConfirm = async () => {
    const { kind, row } = confirm;
    if (!kind || !row) return;

    try {
      if (kind === "delete") {
        await deleteAccountApi({ id: row.id });
        toast.success(t("common.success"));
        if (records.length === 1 && page > 1) setPage(page - 1);
        else await load();
        return;
      }

      if (kind === "resetTraffic") await resetTrafficApi({ id: row.id });
      else await releaseKickAccountApi({ id: row.id });

      toast.success(t("common.success"));
      await load();
    } catch {
      /* toast handled by the API layer */
    }
  };

  const handleKickSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!kick.row) return;

    const kickUtilTime = fromDateTimeLocal(kick.time);
    if (!kickUtilTime) return;

    setKickSaving(true);
    try {
      await hysteria2KickApi({ ids: [kick.row.id], kickUtilTime });
      toast.success(t("common.success"));
      setKick({ open: false, row: null, time: "" });
      await load();
    } catch {
      /* toast handled by the API layer */
    } finally {
      setKickSaving(false);
    }
  };

  const columns = [
    t("accounts.columns.id"),
    t("accounts.columns.remark"),
    t("accounts.columns.username"),
    t("accounts.columns.role"),
    t("accounts.columns.quota"),
    t("accounts.columns.download"),
    t("accounts.columns.upload"),
    t("accounts.columns.online"),
    t("accounts.columns.device"),
    t("accounts.columns.deviceNo"),
    t("accounts.columns.kick"),
    t("accounts.columns.expire"),
    t("accounts.columns.loginAt"),
    t("accounts.columns.conAt"),
    t("accounts.columns.createTime"),
    t("accounts.columns.deleted"),
    t("common.actions"),
  ];

  const confirmTitle =
    confirm.kind === "delete"
      ? t("accounts.deleteTitle")
      : confirm.kind === "resetTraffic"
        ? t("accounts.resetTrafficTitle")
        : confirm.kind === "release"
          ? t("accounts.releaseTitle")
          : "";

  const confirmDescription =
    confirm.kind === "delete"
      ? t("accounts.deleteDescription", {
          username: confirm.row?.username ?? "",
        })
      : confirm.kind === "resetTraffic"
        ? t("accounts.resetTrafficDescription", {
            username: confirm.row?.username ?? "",
          })
        : confirm.kind === "release"
          ? t("accounts.releaseDescription", {
              username: confirm.row?.username ?? "",
            })
          : undefined;

  const confirmLabel =
    confirm.kind === "delete"
      ? t("common.delete")
      : confirm.kind === "resetTraffic"
        ? t("common.resetTraffic")
        : confirm.kind === "release"
          ? t("account.releaseKick")
          : t("common.confirm");

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t("accounts.title")}
          description={t("accounts.description")}
          actions={
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={reload}
            >
              <RefreshCwIcon data-icon="inline-start" />
              {t("common.refresh")}
            </Button>
          }
        />

        <Card>
          <CardContent>
            <form
              className="flex flex-col gap-3"
              onSubmit={handleSearch}
              noValidate
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="filter-remark">
                    {t("account.remark")}
                  </FieldLabel>
                  <Input
                    id="filter-remark"
                    value={filters.remark}
                    maxLength={REMARK_MAX_LENGTH}
                    placeholder={t("account.remark")}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        remark: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="filter-username">
                    {t("account.username")}
                  </FieldLabel>
                  <Input
                    id="filter-username"
                    value={filters.username}
                    maxLength={REMARK_MAX_LENGTH}
                    placeholder={t("account.username")}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        username: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="filter-status">
                    {t("common.deleted")}
                  </FieldLabel>
                  <Select
                    value={filters.deleted ?? "all"}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        deleted: value === "all" ? undefined : value,
                      }))
                    }
                  >
                    <SelectTrigger id="filter-status" className="w-full">
                      <SelectValue placeholder={t("common.all")} />
                    </SelectTrigger>
                    <SelectContent position="popper" align="start">
                      <SelectGroup>
                        <SelectItem value="all">{t("common.all")}</SelectItem>
                        <SelectItem value="0">{t("common.enable")}</SelectItem>
                        <SelectItem value="1">
                          {t("common.disable")}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" size="sm">
                  <SearchIcon data-icon="inline-start" />
                  {t("common.search")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleReset}
                >
                  <RotateCcwIcon data-icon="inline-start" />
                  {t("common.reset")}
                </Button>

                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" onClick={openCreate}>
                    <PlusIcon data-icon="inline-start" />
                    {t("common.add")}
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <UploadIcon data-icon="inline-start" />
                        {t("common.import")}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("accounts.importHint")}</TooltipContent>
                  </Tooltip>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleExport()}
                  >
                    <DownloadIcon data-icon="inline-start" />
                    {t("common.export")}
                  </Button>
                </div>
              </div>
            </form>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(event) => void handleImportFile(event)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow className="hover:bg-transparent">
                  {columns.map((column, index) => (
                    <TableHead
                      key={column}
                      className={cn(
                        "text-xs font-medium text-muted-foreground",
                        secondaryColumnClass(index),
                        index === columns.length - 1 &&
                          "sticky right-0 z-10 border-l bg-muted text-right"
                      )}
                    >
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
                    <TableRow
                      key={`skeleton-${rowIndex}`}
                      className="hover:bg-transparent"
                    >
                      {columns.map((column, index) => (
                        <TableCell key={column} className={secondaryColumnClass(index)}>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : records.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columns.length} className="p-0">
                      <EmptyState
                        icon={UsersRoundIcon}
                        title={t("common.noResults")}
                        description={t("common.noResultsDescription")}
                        className="border-0"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((row) => (
                    <AccountRow
                      key={row.id}
                      row={row}
                      onCommand={handleRowCommand}
                    />
                  ))
                )}
              </TableBody>
            </Table>

            {total > 0 && (
              <DataPagination
                page={page}
                pageSize={pageSize}
                total={total}
                pageSizes={PAGE_SIZES}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            )}
          </CardContent>
        </Card>

        <AccountFormDialog
          open={editor.open}
          account={editor.account}
          focusPassword={editor.focusPassword}
          onOpenChange={(open) =>
            setEditor((prev) => ({ ...prev, open }))
          }
          onSaved={reload}
        />

        <Dialog
          open={kick.open}
          onOpenChange={(open) => {
            if (!open) setKick({ open: false, row: null, time: "" });
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("account.kickTip")}</DialogTitle>
              <DialogDescription>
                {t("accounts.kickDescription")}
              </DialogDescription>
            </DialogHeader>

            <form
              className="flex flex-col gap-4"
              onSubmit={handleKickSubmit}
              noValidate
            >
              <Field>
                <FieldLabel htmlFor="kick-util-time">
                  {t("account.kickUtilTime")}
                </FieldLabel>
                <Input
                  id="kick-util-time"
                  type="datetime-local"
                  value={kick.time}
                  onChange={(event) =>
                    setKick((prev) => ({ ...prev, time: event.target.value }))
                  }
                />
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: `+1${t("common.hours")}`, get: getHourLater },
                    { label: `+1${t("common.days")}`, get: getDayLater },
                    { label: `+7${t("common.days")}`, get: getWeekLater },
                    { label: "+1M", get: getMonthLater },
                  ].map((shortcut) => (
                    <Button
                      key={shortcut.label}
                      type="button"
                      variant="outline"
                      size="xs"
                      title={timestampToDateTime(shortcut.get())}
                      aria-label={`${t(
                        "account.kickUtilTime"
                      )} ${timestampToDateTime(shortcut.get())}`}
                      onClick={() =>
                        setKick((prev) => ({
                          ...prev,
                          time: toDateTimeLocal(shortcut.get()),
                        }))
                      }
                    >
                      {shortcut.label}
                    </Button>
                  ))}
                </div>
              </Field>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={kickSaving}
                  onClick={() => setKick({ open: false, row: null, time: "" })}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={kickSaving || !kick.time}>
                  {kickSaving ? <Spinner /> : null}
                  {t("common.confirm")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={confirm.kind !== null}
          onOpenChange={(open) => {
            if (!open) setConfirm({ kind: null, row: null });
          }}
          title={confirmTitle}
          description={confirmDescription}
          confirmLabel={confirmLabel}
          destructive={confirm.kind === "delete"}
          onConfirm={runConfirm}
        />

        <QrCodeDialog
          open={qr.open}
          onOpenChange={(open) =>
            setQr((prev) => ({ ...prev, open }))
          }
          title={t("dashboard.qrNodeTitle")}
          src={qr.src}
        />
      </div>
    </TooltipProvider>
  );
}
