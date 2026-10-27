import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { LogoMark } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useI18n } from "@/i18n";
import { matchNav } from "@/lib/navigation";

export function AppShell() {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const match = matchNav(pathname);
  const pageLabel = match ? t(match.labelKey) : "H UI";

  useEffect(() => {
    document.title = pageLabel === "H UI" ? "H UI" : `${pageLabel} · H UI`;
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, pageLabel]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/65 md:px-6">
          <SidebarTrigger className="-ml-1 text-muted-foreground" />
          <Link to="/info/account" className="flex items-center gap-2 sm:hidden">
            <LogoMark className="size-6" />
            <span className="text-sm font-semibold tracking-tight">H UI</span>
          </Link>
          <Separator
            orientation="vertical"
            className="mr-1 hidden data-[orientation=vertical]:h-4 sm:block"
          />
          <Breadcrumb className="hidden sm:block">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/info/account">H UI</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {match && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <span className="text-muted-foreground">
                      {t(match.groupKey)}
                    </span>
                  </BreadcrumbItem>
                </>
              )}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{pageLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </header>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-[1760px] min-w-0 flex-1 flex-col gap-8 p-4 md:p-6 lg:p-10">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
