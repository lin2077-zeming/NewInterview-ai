"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GraduationCap, UserRound, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { BackButton } from "@/components/layout/BackButton";

export function Navbar() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="border-b border-white/20 dark:border-white/5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl sticky top-0 z-50 transition-colors" suppressHydrationWarning>
      <div className="w-full flex items-center justify-between h-14 px-6">
        <div className="flex items-center gap-2">
          {/* 全局返回键：能回到真实来源页，没有来路则回首页 */}
          <BackButton />
          <span className="hidden h-5 w-px bg-border sm:inline-block" aria-hidden />
          {/* logo 依然可点回首页，但补上 title —— 原先没有任何提示说明它能点 */}
          <Link
            href="/"
            title="返回首页"
            aria-label="返回首页"
            className="flex items-center gap-2 font-semibold text-lg group"
          >
            <GraduationCap className="h-6 w-6 text-primary transition-transform group-hover:scale-110" />
            <span className="gradient-text">职镜</span>
          </Link>
        </div>
        <nav className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="text-muted-foreground hover:text-foreground"
          >
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="hidden h-4 w-4 dark:block" />
          </Button>
          <Link href="/profile" aria-label="个人信息">
            <Avatar className="h-8 w-8 transition-transform hover:scale-110 ml-1">
              <AvatarFallback className="bg-primary/10">
                <UserRound className="h-4 w-4 text-primary" />
              </AvatarFallback>
            </Avatar>
          </Link>
        </nav>
      </div>
    </header>
  );
}
