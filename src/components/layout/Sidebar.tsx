"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { BarChart3, Briefcase, Home, Plus } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "历史记录", icon: BarChart3 },
  { href: "/interview/new", label: "新面试", icon: Plus },
  { href: "/career", label: "职业规划", icon: Briefcase },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <aside className={cn("w-56 border-r p-4 flex flex-col gap-1", className)}>
      <Link
        href="/"
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted"
      >
        <Home className="h-4 w-4" />
        首页
      </Link>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted"
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
    </aside>
  );
}
