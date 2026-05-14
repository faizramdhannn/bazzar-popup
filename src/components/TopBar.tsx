"use client";
import { signOut } from "next-auth/react";
import { Sun, Moon, LogOut } from "lucide-react";
import { useTheme } from "@/app/theme-provider";

export function TopBar({ user }: { user: { name?: string; role?: string } }) {
  const { theme, toggle } = useTheme();

  return (
    <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-500">{user?.name}</span>
        <button
          onClick={toggle}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
