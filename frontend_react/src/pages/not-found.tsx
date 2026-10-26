import { CompassIcon, MoveLeftIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export function NotFoundPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-lg">
        <EmptyState
          icon={CompassIcon}
          title={`404 · ${t("error.title404")}`}
          description={t("error.description404")}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => navigate("/info/account")}>
                {t("error.backHome")}
              </Button>
              <Button variant="outline" onClick={() => navigate(-1)}>
                <MoveLeftIcon data-icon="inline-start" />
                {t("error.backPrevious")}
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
}
