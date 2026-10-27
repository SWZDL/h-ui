import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label="H UI"
      className={cn("size-8 shrink-0", className)}
    >
      <defs>
        <linearGradient id="hui-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.29 0.012 92)" />
          <stop offset="100%" stopColor="oklch(0.2 0.01 92)" />
        </linearGradient>
        <linearGradient id="hui-logo-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.96" />
          <stop offset="100%" stopColor="white" stopOpacity="0.72" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#hui-logo-bg)" />
      <path
        d="M13 11.5v17M27 11.5v17M13 20h14"
        stroke="url(#hui-logo-glow)"
        strokeWidth="3.1"
        strokeLinecap="round"
      />
      <circle cx="27" cy="11.5" r="2.6" fill="oklch(0.83 0.1 88)" />
    </svg>
  );
}

export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight">H UI</span>
          <span className="mt-1 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Hysteria2
          </span>
        </div>
      )}
    </div>
  );
}
