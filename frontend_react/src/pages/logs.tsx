import { DownloadIcon, RefreshCwIcon, ScrollTextIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { exportLogApi, logHysteria2Api, logSystemApi } from "@/api/log";
import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/i18n";
import { downloadResponse } from "@/lib/io";
import { cn } from "@/lib/utils";
import type { LogHysteria2Vo, LogSystemVo } from "@/types/api";

const LINE_OPTIONS = [100, 200, 300] as const;

/** System rows carry request metadata on top of the shared log shape. */
type LogRow = LogHysteria2Vo & Partial<Omit<LogSystemVo, keyof LogHysteria2Vo>>;

type LevelVariant = "secondary" | "outline" | "destructive";

function levelVariant(level: string): LevelVariant {
  switch (level.trim().toLowerCase()) {
    case "error":
    case "fatal":
    case "panic":
      return "destructive";
    case "warn":
    case "warning":
      return "outline";
    default:
      // debug / trace / info and anything unknown stay quiet.
      return "secondary";
  }
}

function requestSummary(row: LogRow): string {
  return [
    [row.reqMethod, row.reqUri].filter(Boolean).join(" "),
    row.clientIp,
    row.statusCode,
    row.latencyTime,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

export function LogsPage({ kind }: { kind: "system" | "hysteria" }) {
  const { t } = useI18n();

  const [records, setRecords] = useState<LogRow[]>([]);
  const [numLine, setNumLine] = useState<number>(LINE_OPTIONS[0]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [loadedKind, setLoadedKind] = useState(kind);

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  // Both routes render this component, so switching sides reuses the state.
  // Reset synchronously during render to avoid showing the other log briefly.
  if (loadedKind !== kind) {
    setLoadedKind(kind);
    setRecords([]);
    setLoading(true);
  }

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const page =
        kind === "system"
          ? await logSystemApi({ numLine })
          : await logHysteria2Api({ numLine });
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setRecords(page.records);
    } catch {
      /* toast handled by the API layer */
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [kind, numLine]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await exportLogApi({
        option: kind === "system" ? 0 : 1,
      });
      downloadResponse(
        response,
        kind === "system" ? "h-ui-system-log.txt" : "h-ui-hysteria-log.txt"
      );
      toast.success(t("common.downloadStarted"));
    } catch {
      /* toast handled by the API layer */
    } finally {
      if (mountedRef.current) setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          kind === "system" ? t("log.systemTitle") : t("log.hysteriaTitle")
        }
        description={t("log.description")}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => void handleExport()}
            >
              <DownloadIcon data-icon="inline-start" />
              {t("common.export")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCwIcon
                data-icon="inline-start"
                className={cn(loading && "animate-spin")}
              />
              {t("common.refresh")}
            </Button>
          </>
        }
      />

      <Card className="gap-0">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Label
                htmlFor="log-num-line"
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                {t("log.numLine")}
              </Label>
              <Select
                value={String(numLine)}
                onValueChange={(value) => setNumLine(Number(value))}
              >
                <SelectTrigger
                  id="log-num-line"
                  size="sm"
                  className="w-20"
                  aria-label={t("log.numLine")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                  <SelectGroup>
                    {LINE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {!loading && records.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {t("common.totalRows", { total: records.length })}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-0">
          {!loading && records.length === 0 ? (
            <EmptyState
              icon={ScrollTextIcon}
              title={t("common.noData")}
              description={t("log.empty")}
              className="border-0"
            />
          ) : (
            <Table className="min-w-[40rem]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-28 px-4">
                    {t("log.level")}
                  </TableHead>
                  <TableHead className="w-44 px-4">{t("log.time")}</TableHead>
                  <TableHead className="px-4">{t("log.message")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 8 }).map((_, index) => (
                      <TableRow key={index} className="hover:bg-transparent">
                        <TableCell className="px-4 py-2.5 align-top">
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </TableCell>
                        <TableCell className="px-4 py-2.5 align-top">
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell className="px-4 py-2.5 align-top">
                          <Skeleton className="h-4 w-full max-w-md" />
                        </TableCell>
                      </TableRow>
                    ))
                  : records.map((row, index) => {
                      const request =
                        kind === "system" ? requestSummary(row) : "";
                      return (
                        <TableRow key={`${row.time}-${index}`}>
                          <TableCell className="px-4 py-2.5 align-top">
                            <Badge
                              variant={levelVariant(row.level)}
                              className="font-mono"
                            >
                              {row.level || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-2.5 align-top">
                            <span className="font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                              {row.time || "-"}
                            </span>
                          </TableCell>
                          <TableCell className="min-w-0 px-4 py-2.5 align-top font-mono text-xs whitespace-pre-wrap break-words">
                            <div className="flex flex-col gap-1">
                              <span>{row.msg || "-"}</span>
                              {request && (
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-muted-foreground">
                                  <span className="font-sans font-medium">
                                    {t("log.request")}
                                  </span>
                                  <span className="break-words">
                                    {request}
                                  </span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
