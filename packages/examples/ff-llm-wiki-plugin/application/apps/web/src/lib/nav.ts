import type { ComponentType, SVGProps } from "react";
import {
  DashboardIcon,
  DocumentIcon,
  WikiIcon,
  GraphIcon,
  QaIcon,
  EvalIcon,
  SettingsIcon,
} from "../components/Icons";

export interface NavItem {
  href: string;
  label: string;
  /** 仅精确匹配（用于首页「/」） */
  exact?: boolean;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Knowledge Workbench", exact: true, icon: DashboardIcon },
  { href: "/documents", label: "Documents", icon: DocumentIcon },
  { href: "/wiki", label: "Wiki", icon: WikiIcon },
  { href: "/knowledge-graph", label: "Knowledge Graph", icon: GraphIcon },
  { href: "/ask", label: "Ask the Agent", icon: QaIcon },
  { href: "/evaluation", label: "Evaluation", icon: EvalIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
