"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  ShoppingCart,
  Store,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: ("admin" | "staff")[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="w-4 h-4" />, roles: ["admin", "staff"] },
  { label: "Stock", href: "/dashboard/stock", icon: <Package className="w-4 h-4" />, roles: ["admin", "staff"] },
  { label: "Stock Opname", href: "/dashboard/opname", icon: <ClipboardList className="w-4 h-4" />, roles: ["admin", "staff"] },
  { label: "Sales", href: "/dashboard/sales", icon: <ShoppingCart className="w-4 h-4" />, roles: ["admin", "staff"] },
  { label: "Popup List", href: "/dashboard/popup", icon: <Store className="w-4 h-4" />, roles: ["admin"] },
];

export function Sidebar({ role }: { role: "admin" | "staff" }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col">
      <div className="px-4 py-5 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-base font-bold tracking-tight">Bazaar ERP</span>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems
          .filter((item) => item.roles.includes(role))
          .map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
      </nav>
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
        <span className="px-3 py-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full capitalize">
          {role}
        </span>
      </div>
    </aside>
  );
}
