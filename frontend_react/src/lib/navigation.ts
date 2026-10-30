import {
  ActivityIcon,
  FileTextIcon,
  RocketIcon,
  ScrollTextIcon,
  SendIcon,
  Settings2Icon,
  TerminalSquareIcon,
  UserRoundIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";

export interface NavLeaf {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

export interface NavEntry {
  labelKey: string;
  icon: LucideIcon;
  to?: string;
  children?: NavLeaf[];
}

export interface NavGroup {
  labelKey: string;
  entries: NavEntry[];
  /** Hidden from regular accounts; the routes themselves require the admin role. */
  adminOnly?: boolean;
}

export const navGroups: NavGroup[] = [
  {
    labelKey: "app.nav.workspace",
    entries: [
      {
        to: "/info/account",
        labelKey: "nav.overview",
        icon: UserRoundIcon,
      },
    ],
  },
  {
    labelKey: "app.nav.manage",
    adminOnly: true,
    entries: [
      { to: "/account/list", labelKey: "nav.accounts", icon: UsersRoundIcon },
      { to: "/hysteria/list", labelKey: "nav.hysteria", icon: RocketIcon },
      { to: "/telegram/list", labelKey: "nav.telegram", icon: SendIcon },
    ],
  },
  {
    labelKey: "app.nav.system",
    adminOnly: true,
    entries: [
      { to: "/config/list", labelKey: "nav.settings", icon: Settings2Icon },
      { to: "/monitor/system", labelKey: "nav.monitor", icon: ActivityIcon },
      {
        labelKey: "nav.logs",
        icon: ScrollTextIcon,
        children: [
          {
            to: "/log/system",
            labelKey: "route.logSystem",
            icon: FileTextIcon,
          },
          {
            to: "/log/hysteria",
            labelKey: "route.logHysteria",
            icon: TerminalSquareIcon,
          },
        ],
      },
    ],
  },
];

/** The navigation that the signed-in account is allowed to see. */
export function navGroupsFor(isAdmin: boolean): NavGroup[] {
  return isAdmin ? navGroups : navGroups.filter((group) => !group.adminOnly);
}

export interface NavMatch {
  labelKey: string;
  groupKey: string;
  parentKey?: string;
}

/** Resolve the current route to sidebar / breadcrumb labels. */
export function matchNav(
  pathname: string,
  groups: NavGroup[] = navGroups
): NavMatch | null {
  for (const group of groups) {
    for (const entry of group.entries) {
      if (entry.to && pathname === entry.to) {
        return { labelKey: entry.labelKey, groupKey: group.labelKey };
      }
      const child = entry.children?.find((item) => item.to === pathname);
      if (child) {
        return {
          labelKey: child.labelKey,
          groupKey: group.labelKey,
          parentKey: entry.labelKey,
        };
      }
    }
  }
  return null;
}
