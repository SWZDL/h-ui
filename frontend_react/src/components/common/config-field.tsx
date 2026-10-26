import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

interface ConfigFieldProps {
  label: string;
  hint?: string;
  hintSide?: "top" | "right" | "bottom" | "left";
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label + "why" tooltip + control + inline error, used across config forms. */
export function ConfigField({
  label,
  hint,
  hintSide = "bottom",
  htmlFor,
  required,
  optional,
  error,
  description,
  className,
  children,
}: ConfigFieldProps) {
  const { t } = useI18n();

  return (
    <Field data-invalid={Boolean(error)} className={cn("gap-2", className)}>
      <div className="flex items-center gap-1.5">
        <FieldLabel htmlFor={htmlFor} className="font-mono text-xs">
          {label}
        </FieldLabel>
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
        {optional && (
          <span className="text-[10px] text-muted-foreground">
            {t("common.optional")}
          </span>
        )}
        {hint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-4 rounded-full text-muted-foreground/70 hover:text-foreground"
                aria-label={label}
              >
                <InfoIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={hintSide} className="max-w-xs text-pretty">
              {hint}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
      {description && <FieldDescription>{description}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}
