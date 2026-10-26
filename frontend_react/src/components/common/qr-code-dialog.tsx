import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n";

interface QrCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  src: string;
  description?: string;
  filename?: string;
}

export function QrCodeDialog({
  open,
  onOpenChange,
  title,
  src,
  description,
  filename = "h-ui-qrcode.png",
}: QrCodeDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-xl bg-white p-3 ring-1 ring-foreground/10">
            <img
              src={src}
              alt={title}
              className="size-64 max-w-full object-contain"
            />
          </div>
          <p className="max-w-xs text-center text-xs text-muted-foreground">
            {description ?? t("dashboard.qrHint")}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" asChild>
            <a href={src} download={filename}>
              <DownloadIcon data-icon="inline-start" />
              {t("common.export")}
            </a>
          </Button>
          <Button onClick={() => onOpenChange(false)}>{t("common.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
