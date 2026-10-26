import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const options = [
    { value: "light", label: t("app.themeLight"), icon: SunIcon },
    { value: "dark", label: t("app.themeDark"), icon: MoonIcon },
    { value: "system", label: t("app.themeSystem"), icon: MonitorIcon },
  ] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn("text-muted-foreground", className)}
          aria-label={t("app.themeLabel")}
        >
          {mounted ? (
            resolvedTheme === "dark" ? (
              <MoonIcon data-icon="inline-start" />
            ) : (
              <SunIcon data-icon="inline-start" />
            )
          ) : (
            <SunIcon data-icon="inline-start" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setTheme(option.value)}
          >
            <option.icon />
            <span>{option.label}</span>
            {theme === option.value && <CheckIcon className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
