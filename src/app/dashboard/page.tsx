// src/app/dashboard/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LayoutDashboard } from "lucide-react";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { name?: string; role?: string };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <LayoutDashboard className="w-5 h-5" />
        <h1 className="text-xl font-semibold">Dashboard</h1>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <p className="text-zinc-500 text-sm">
          Selamat datang, <span className="font-medium text-zinc-900 dark:text-zinc-100">{user?.name}</span>!
          Role Anda: <span className="font-medium capitalize">{user?.role}</span>
        </p>
        <p className="text-zinc-400 text-sm mt-2">
          Gunakan menu di sebelah kiri untuk mengakses fitur.
        </p>
      </div>
    </div>
  );
}
