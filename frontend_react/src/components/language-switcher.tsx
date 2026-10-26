import { CheckIcon, LanguagesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locales, useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn("text-muted-foreground", className)}
          aria-label={t("app.languageLabel")}
        >
          <LanguagesIcon data-icon="inline-start" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {locales.map((item) => (
          <DropdownMenuItem key={item.value} onClick={() => setLocale(item.value)}>
            <span className="w-5 text-xs font-medium text-muted-foreground">
              {item.short}
            </span>
            <span>{item.label}</span>
            {locale === item.value && <CheckIcon className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
