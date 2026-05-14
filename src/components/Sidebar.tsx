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
  X,
} from "lucide-react";
import { useEffect } from "react";

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

interface SidebarProps {
  role: "admin" | "staff";
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ role, open, onClose }: SidebarProps) {
  const pathname = usePathname();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onClose();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prevent body scroll when sidebar open on mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Backdrop (mobile only) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col",
          "bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800",
          "transform transition-transform duration-300 ease-in-out",
          "lg:static lg:translate-x-0 lg:w-56 lg:shrink-0 lg:z-auto",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="px-4 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <span className="text-base font-bold tracking-tight">Bazaar ERP</span>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems
            .filter((item) => item.roles.includes(role))
            .map((item) => {
              // Exact match for /dashboard, prefix match for deeper routes
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
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

        {/* Role badge */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
          <span className="px-3 py-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full capitalize">
            {role}
          </span>
        </div>
      </aside>
    </>
  );
}