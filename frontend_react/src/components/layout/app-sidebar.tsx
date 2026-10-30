import { ChevronDownIcon, ChevronsUpDownIcon, LogOutIcon } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Logo, LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/auth";
import { useI18n } from "@/i18n";
import { navGroupsFor } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user, isAdmin, logout } = useAuth();
  const { state, isMobile } = useSidebar();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const collapsed = state === "collapsed";
  const initials = (user?.username ?? "H").slice(0, 2).toUpperCase();
  const roleLabel = isAdmin ? t("app.roleAdmin") : t("app.roleUser");
  const groups = navGroupsFor(isAdmin);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="h-14 justify-center px-2">
        <Link
          to="/info/account"
          className="flex items-center gap-2.5 overflow-hidden px-1"
        >
          {collapsed && !isMobile ? <LogoMark /> : <Logo />}
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="px-0 py-2">
        {groups.map((group) => (
          <SidebarGroup key={group.labelKey} className="py-1">
            <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.entries.map((entry) => {
                  if (entry.children) {
                    const groupActive = entry.children.some(
                      (child) => child.to === pathname
                    );
                    const Icon = entry.icon;
                    return (
                      <Collapsible
                        key={entry.labelKey}
                        asChild
                        defaultOpen={groupActive || pathname.startsWith("/log")}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              tooltip={t(entry.labelKey)}
                              className={cn(
                                groupActive &&
                                  "bg-sidebar-accent text-sidebar-accent-foreground"
                              )}
                            >
                              <Icon />
                              <span>{t(entry.labelKey)}</span>
                              <ChevronDownIcon className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180 group-data-[collapsible=icon]:hidden" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {entry.children.map((child) => (
                                <SidebarMenuSubItem key={child.to}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={pathname === child.to}
                                  >
                                    <Link to={child.to}>
                                      <child.icon />
                                      <span>{t(child.labelKey)}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }

                  const Icon = entry.icon;
                  return (
                    <SidebarMenuItem key={entry.to ?? entry.labelKey}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === entry.to}
                        tooltip={t(entry.labelKey)}
                      >
                        <Link to={entry.to ?? "/"}>
                          <Icon />
                          <span>{t(entry.labelKey)}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-2 pb-3">
        <div className="hidden items-center gap-1 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/12 text-xs font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 leading-tight">
                    <span className="truncate text-sm font-medium">
                      {user?.username}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {roleLabel}
                    </span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={8}
                className="w-56"
              >
                <DropdownMenuLabel className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    {t("app.signedInAs")}
                  </span>
                  <span className="truncate text-sm font-medium text-foreground">
                    {user?.username}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setLogoutOpen(true)}
                >
                  <LogOutIcon />
                  {t("navbar.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />

      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title={t("app.logoutTitle")}
        description={t("app.logoutDescription")}
        confirmLabel={t("navbar.logout")}
        onConfirm={handleLogout}
      />
    </Sidebar>
  );
}
