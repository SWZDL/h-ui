import { PlusIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";

interface Row {
  id: number;
  key: string;
  value: string;
}

let rowSeq = 0;
const nextRowId = () => ++rowSeq;

function toRows(record: Record<string, string>): Row[] {
  return Object.entries(record).map(([key, value]) => ({
    id: nextRowId(),
    key,
    value,
  }));
}

function toRecord(rows: Row[]): { record: Record<string, string> | null; duplicateKeys: Set<string> } {
  const duplicateKeys = new Set<string>();
  const seen = new Set<string>();
  const record: Record<string, string> = {};

  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    if (seen.has(key)) duplicateKeys.add(key);
    seen.add(key);
    record[key] = row.value;
  }

  return { record: duplicateKeys.size > 0 ? null : record, duplicateKeys };
}

interface KeyValueEditorProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
  emptyLabel?: string;
}

/** Inline key/value editor used for ACME DNS config and masquerade headers. */
export function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  addLabel,
  emptyLabel,
}: KeyValueEditorProps) {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>(() => toRows(value));
  const lastEmitted = useRef(JSON.stringify(value));

  useEffect(() => {
    const serialized = JSON.stringify(value);
    if (serialized !== lastEmitted.current) {
      lastEmitted.current = serialized;
      setRows(toRows(value));
    }
  }, [value]);

  const apply = (nextRows: Row[]) => {
    setRows(nextRows);
    const { record } = toRecord(nextRows);
    if (record) {
      lastEmitted.current = JSON.stringify(record);
      onChange(record);
    }
  };

  const { duplicateKeys } = toRecord(rows);

  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {emptyLabel ?? t("hysteria.noTags")}
        </p>
      )}

      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          <Input
            value={row.key}
            placeholder={keyPlaceholder ?? t("hysteria.mapKey")}
            aria-invalid={duplicateKeys.has(row.key.trim())}
            className="font-mono text-xs"
            onChange={(event) => {
              const next = rows.map((item) =>
                item.id === row.id ? { ...item, key: event.target.value } : item
              );
              apply(next);
            }}
          />
          <span className="text-muted-foreground">=</span>
          <Input
            value={row.value}
            placeholder={valuePlaceholder ?? t("hysteria.mapValue")}
            className="font-mono text-xs"
            onChange={(event) => {
              const next = rows.map((item) =>
                item.id === row.id ? { ...item, value: event.target.value } : item
              );
              apply(next);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label={t("common.remove")}
            onClick={() => apply(rows.filter((item) => item.id !== row.id))}
          >
            <XIcon />
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRows([...rows, { id: nextRowId(), key: "", value: "" }])}
        >
          <PlusIcon data-icon="inline-start" />
          {addLabel ?? t("hysteria.mapAdd")}
        </Button>
        {duplicateKeys.size > 0 && (
          <span className="text-xs text-destructive">
            {t("common.valueExists")}
          </span>
        )}
      </div>
    </div>
  );
}
