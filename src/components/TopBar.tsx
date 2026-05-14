"use client";
import { signOut } from "next-auth/react";
import { Sun, Moon, LogOut, Menu } from "lucide-react";
import { useTheme } from "@/app/theme-provider";

interface TopBarProps {
  user: { name?: string; role?: string };
  onMenuToggle: () => void;
}

export function TopBar({ user, onMenuToggle }: TopBarProps) {
  const { theme, toggle } = useTheme();

  return (
    <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between px-4 md:px-6 shrink-0">
      {/* Left: hamburger (mobile) */}
      <button
        onClick={onMenuToggle}
        className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors lg:hidden"
        aria-label="Buka menu"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Desktop spacer */}
      <div className="hidden lg:block" />

      {/* Right: actions */}
      <div className="flex items-center gap-2 md:gap-3">
        <span className="text-sm text-zinc-500 hidden sm:block truncate max-w-[120px]">
          {user?.name}
        </span>
        <button
          onClick={toggle}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Ganti tema"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400"
          aria-label="Keluar"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}