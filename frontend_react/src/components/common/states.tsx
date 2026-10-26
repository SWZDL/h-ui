import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export function LoadingState({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex min-h-40 flex-col items-center justify-center gap-3 text-sm text-muted-foreground",
        className
      )}
    >
      <Spinner className="size-5" />
      <span>{label ?? t("common.loading")}</span>
    </div>
  );
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Empty className={cn("border border-dashed", className)}>
      <EmptyHeader>
        {Icon && (
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
        )}
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
