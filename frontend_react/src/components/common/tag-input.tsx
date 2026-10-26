import { PlusIcon, XIcon } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  emptyLabel?: string;
  className?: string;
}

/** Editable list of strings (domains, inline ACL rules, …). */
export function TagInput({
  value,
  onChange,
  placeholder,
  addLabel,
  emptyLabel,
  className,
}: TagInputProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");

  const commit = () => {
    const items = draft
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (items.length === 0) return;

    const next = [...value];
    for (const item of items) {
      if (!next.includes(item)) next.push(item);
    }
    onChange(next);
    setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item, index) => (
            <Badge
              key={`${item}-${index}`}
              variant="secondary"
              className="h-6 gap-1 pr-1 font-mono text-xs font-normal"
            >
              <span className="max-w-56 truncate">{item}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                aria-label={`${t("common.remove")} ${item}`}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        emptyLabel && (
          <p className="text-xs text-muted-foreground">{emptyLabel}</p>
        )
      )}

      <InputGroup className="max-w-md">
        <InputGroupInput
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            onClick={commit}
            disabled={!draft.trim()}
            aria-label={addLabel ?? t("hysteria.addTag")}
          >
            <PlusIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

/** Single-line input with a mono font, used for paths / URLs / durations. */
export function MonoInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return <Input className={cn("font-mono text-xs", className)} {...props} />;
}
