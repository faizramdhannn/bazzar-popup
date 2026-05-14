"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
import { SessionUser } from "@/types";
import { formatDate } from "@/lib/utils";

interface SalesRow {
  sales_user_id: string;
  sales_id: string;
  item_sku: string;
  item_name: string;
  item_variant: string;
  item_qty: string;
  delivery_note: string;
  created_by: string;
  created_at: string;
}

interface PopupStore { id_location: string; popup_name: string; popup_location: string; }
interface MasterItem { item_sku: string; item_name: string; item_variant: string; }

export default function SalesPage() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser & { name: string };
  const isAdmin = user?.role === "admin";

  const [sales, setSales] = useState<SalesRow[]>([]);
  const [popups, setPopups] = useState<PopupStore[]>([]);
  const [items, setItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ sales_user_id: "", item_sku: "", item_qty: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [sRes, pRes, iRes] = await Promise.all([
      fetch("/api/sales"), fetch("/api/popup"), fetch("/api/master-items"),
    ]);
    const [s, p, i] = await Promise.all([sRes.json(), pRes.json(), iRes.json()]);
    setSales(s.data ?? []);
    setPopups(p.data ?? []);
    setItems(i.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAdd() {
    if (!form.sales_user_id || !form.item_sku || !form.item_qty) {
      setMsg("Lengkapi semua field"); return;
    }
    setSaving(true);
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, item_qty: Number(form.item_qty) }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setMsg(`Penjualan disimpan. DN: ${data.dn}`);
      setShowAdd(false);
      setForm({ sales_user_id: "", item_sku: "", item_qty: "" });
      fetchData();
    } else setMsg(data.error);
  }

  async function handleDelete(salesId: string) {
    if (!confirm("Hapus penjualan ini? Stock akan dikembalikan.")) return;
    const res = await fetch(`/api/sales?sales_id=${salesId}`, { method: "DELETE" });
    const data = await res.json();
    setMsg(data.message || data.error);
    fetchData();
  }

  const columns: ColumnDef<SalesRow, unknown>[] = [
    { header: "Sales ID", accessorKey: "sales_id" },
    { header: "Popup", accessorKey: "sales_user_id" },
    { header: "SKU", accessorKey: "item_sku" },
    { header: "Nama Item", accessorKey: "item_name" },
    { header: "Varian", accessorKey: "item_variant" },
    { header: "Qty", accessorKey: "item_qty" },
    { header: "Delivery Note", accessorKey: "delivery_note" },
    { header: "Oleh", accessorKey: "created_by" },
    { header: "Tanggal", accessorKey: "created_at", cell: ({ row }) => formatDate(row.original.created_at) },
    ...(isAdmin ? [{
      header: "Aksi",
      id: "actions",
      cell: ({ row }: { row: { original: SalesRow } }) => (
        <button onClick={() => handleDelete(row.original.sales_id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ),
    } as ColumnDef<SalesRow, unknown>] : []),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          <h1 className="text-xl font-semibold">Sales</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah Penjualan
        </button>
      </div>

      {msg && (
        <div className="mb-4 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm">
          {msg} <button onClick={() => setMsg("")} className="ml-3 text-zinc-400">×</button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-400 py-8 text-center">Memuat data...</div>
      ) : (
        <DataTable data={sales} columns={columns} />
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Tambah Penjualan" size="sm">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Popup / Lokasi</label>
            <select
              value={form.sales_user_id}
              onChange={(e) => setForm({ ...form, sales_user_id: e.target.value })}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm outline-none"
            >
              <option value="">Pilih Popup</option>
              {popups.map((p) => <option key={p.id_location} value={p.id_location}>{p.popup_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Item</label>
            <select
              value={form.item_sku}
              onChange={(e) => setForm({ ...form, item_sku: e.target.value })}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm outline-none"
            >
              <option value="">Pilih Item</option>
              {items.map((i) => <option key={i.item_sku} value={i.item_sku}>{i.item_sku} - {i.item_name} {i.item_variant}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Qty Terjual</label>
            <input
              type="number"
              min="1"
              value={form.item_qty}
              onChange={(e) => setForm({ ...form, item_qty: e.target.value })}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm outline-none"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan & Buat DN"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
