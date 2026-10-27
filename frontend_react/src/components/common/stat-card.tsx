import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  badge?: ReactNode;
  hint?: ReactNode;
  progress?: number;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  badge,
  hint,
  progress,
  className,
}: StatCardProps) {
  return (
    <Card size="sm" className={cn("gap-3", className)}>
      <CardHeader className="gap-1">
        <CardDescription className="flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
          {Icon && (
            <span className="flex size-6 items-center justify-center rounded-md bg-muted text-foreground">
              <Icon className="size-3.5" />
            </span>
          )}
          <span className="truncate">{label}</span>
        </CardDescription>
        {badge && <CardAction>{badge}</CardAction>}
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <div className="text-3xl font-medium tracking-tight tabular-nums">
          {value}
        </div>
        {typeof progress === "number" && (
          <Progress value={Math.min(Math.max(progress, 0), 100)} />
        )}
        {hint && (
          <div className="text-[13px] text-muted-foreground tabular-nums">{hint}</div>
        )}
      </CardContent>
    </Card>
  );
}

export function TinyBadge({
  children,
  variant = "outline",
}: {
  children: ReactNode;
  variant?: "outline" | "secondary" | "destructive" | "default";
}) {
  return (
    <Badge variant={variant} className="font-mono text-[10px] font-normal">
      {children}
    </Badge>
  );
}
