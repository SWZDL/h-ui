import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

interface DataPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizes?: number[];
  className?: string;
}

function pageWindow(current: number, totalPages: number): (number | "dots")[] {
  if (totalPages <= 6) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, current]);
  if (current > 2) pages.add(current - 1);
  if (current < totalPages - 1) pages.add(current + 1);

  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort(
    (a, b) => a - b
  );

  const result: (number | "dots")[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) {
      result.push("dots");
    }
    result.push(page);
  });
  return result;
}

export function DataPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = [10, 20, 30, 50],
  className,
}: DataPaginationProps) {
  const { t } = useI18n();
  const totalPages = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));
  const pages = pageWindow(page, totalPages);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>{t("common.totalRows", { total })}</span>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">{t("common.rowsPerPage")}</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger size="sm" className="h-7 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  {pageSizes.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Pagination className="mx-0 w-auto justify-start sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label={t("common.previous")}
            >
              <ChevronLeftIcon />
            </Button>
          </PaginationItem>

          {pages.map((item, index) =>
            item === "dots" ? (
              <PaginationItem key={`dots-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <Button
                  variant={item === page ? "outline" : "ghost"}
                  size="icon-sm"
                  aria-current={item === page ? "page" : undefined}
                  onClick={() => onPageChange(item)}
                  className="tabular-nums"
                >
                  {item}
                </Button>
              </PaginationItem>
            )
          )}

          <PaginationItem>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label={t("common.next")}
            >
              <ChevronRightIcon />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
