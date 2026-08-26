"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { normalizeRole, type Role } from "@/lib/constants/roles";
import { NAV_CONFIG, type NavItem } from "./sidebar-nav";
import { SidebarIcon } from "./SidebarIcon";
import { isNavActive, isParentRegisterActive } from "./sidebar-nav-utils";

// ─── NavMenuItem ───────────────────────────────────────────────────────────
// Renders a single navigation item, handling both simple links and collapsible items with children

interface NavMenuItemProps {
  item: NavItem;
  pathname: string;
  searchParams: URLSearchParams;
}

function NavMenuItem({ item, pathname, searchParams }: NavMenuItemProps) {
  const isActive = isNavActive(pathname, searchParams, item);

  // Simple item without children
  if (!item.children?.length) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
          <Link href={item.href} prefetch={false}>
            <SidebarIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  // Item with children - use Collapsible
  const parentActive = isParentRegisterActive(pathname, searchParams, item);

  return (
    <Collapsible defaultOpen={parentActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={parentActive} tooltip={item.label}>
            <SidebarIcon name={item.icon} />
            <span>{item.label}</span>
            <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children.map((child) => {
              const childActive = isNavActive(pathname, searchParams, child);
              return (
                <SidebarMenuSubItem key={child.href}>
                  <SidebarMenuSubButton asChild isActive={childActive}>
                    <Link href={child.href} prefetch={false}>
                      <span>{child.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// ─── AppSidebar ────────────────────────────────────────────────────────────
// Main sidebar component using shadcn/ui primitives with collapsible icon mode

interface AppSidebarProps {
  role: Role;
}

export function AppSidebar({ role }: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizedRole = normalizeRole(role);
  const sections = normalizedRole ? NAV_CONFIG[normalizedRole] ?? [] : [];

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarContent className="pt-2">
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-sidebar-foreground/70">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <NavMenuItem
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    searchParams={searchParams}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
