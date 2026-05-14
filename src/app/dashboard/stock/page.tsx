"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Upload, Package } from "lucide-react";
import { SessionUser } from "@/types";

interface StockRow {
  stock_popup_id: string;
  item_sku: string;
  item_name: string;
  item_variant: string;
  item_qty: string;
  item_category: string;
  item_hpj: string;
  item_discount: string;
}

interface PopupStore { id_location: string; popup_name: string; popup_location: string; }
interface MasterItem { item_sku: string; item_name: string; item_variant: string; item_category: string; item_hpj: string; }

export default function StockPage() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser & { name: string };
  const isAdmin = user?.role === "admin";

  const [stock, setStock] = useState<StockRow[]>([]);
  const [popups, setPopups] = useState<PopupStore[]>([]);
  const [items, setItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPopup, setSelectedPopup] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [addForm, setAddForm] = useState({ item_sku: "", item_qty: "" });
  const [bulkCsv, setBulkCsv] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = selectedPopup ? `?popup_id=${selectedPopup}` : "";
    const [stockRes, popupRes, itemRes] = await Promise.all([
      fetch(`/api/stock${params}`), fetch("/api/popup"), fetch("/api/master-items"),
    ]);
    const [s, p, i] = await Promise.all([stockRes.json(), popupRes.json(), itemRes.json()]);
    setStock(s.data ?? []);
    setPopups(p.data ?? []);
    setItems(i.data ?? []);
    setLoading(false);
  }, [selectedPopup]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns: ColumnDef<StockRow, unknown>[] = [
    { header: "Popup", accessorKey: "stock_popup_id" },
    { header: "SKU", accessorKey: "item_sku" },
    { header: "Nama Item", accessorKey: "item_name" },
    { header: "Varian", accessorKey: "item_variant" },
    { header: "Kategori", accessorKey: "item_category" },
    {
      header: "Qty", accessorKey: "item_qty",
      cell: ({ row }) => (
        <span className={`font-semibold ${Number(row.original.item_qty) === 0 ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
          {row.original.item_qty}
        </span>
      ),
    },
    {
      header: "HPJ", accessorKey: "item_hpj",
      cell: ({ row }) => `Rp ${Number(row.original.item_hpj).toLocaleString("id-ID")}`,
    },
  ];

  async function handleAddStock() {
    setSaving(true);
    const res = await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock_popup_id: selectedPopup, ...addForm, item_qty: Number(addForm.item_qty) }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) { setMsg("Stock berhasil ditambah"); setShowAdd(false); fetchData(); }
    else setMsg(data.error);
  }

  async function handleBulkUpload() {
    setSaving(true);
    const lines = bulkCsv.trim().split("\n").slice(1);
    const parsed = lines.map((l) => {
      const [stock_popup_id, item_sku, item_qty] = l.split(",").map((s) => s.trim());
      return { stock_popup_id, item_sku, item_qty: Number(item_qty) };
    }).filter((r) => r.item_sku && r.item_qty);

    const res = await fetch("/api/stock/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: parsed }),
    });
    const data = await res.json();
    setSaving(false);
    setMsg(data.message || data.error);
    if (res.ok) { setShowBulk(false); fetchData(); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 md:mb-6">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          <h1 className="text-lg md:text-xl font-semibold">Stock</h1>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowBulk(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bulk Upload</span>
            </button>
            <button
              onClick={() => { if (!selectedPopup) { setMsg("Pilih popup terlebih dahulu"); return; } setShowAdd(true); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tambah Stock</span>
              <span className="sm:hidden">Tambah</span>
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div className="mb-4 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm">
          {msg}
          <button onClick={() => setMsg("")} className="ml-3 text-zinc-400 hover:text-zinc-600">×</button>
        </div>
      )}

      <div className="mb-4">
        <select
          value={selectedPopup}
          onChange={(e) => setSelectedPopup(e.target.value)}
          className="w-full sm:w-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none"
        >
          <option value="">Semua Popup</option>
          {popups.map((p) => (
            <option key={p.id_location} value={p.id_location}>{p.popup_name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-400 py-8 text-center">Memuat data...</div>
      ) : (
        <DataTable data={stock} columns={columns} />
      )}

      {/* Add Stock Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Tambah Stock" size="sm">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Item SKU</label>
            <select
              value={addForm.item_sku}
              onChange={(e) => setAddForm({ ...addForm, item_sku: e.target.value })}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 text-sm outline-none"
            >
              <option value="">Pilih Item</option>
              {items.map((i) => (
                <option key={i.item_sku} value={i.item_sku}>{i.item_sku} - {i.item_name} {i.item_variant}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Qty</label>
            <input
              type="number"
              value={addForm.item_qty}
              onChange={(e) => setAddForm({ ...addForm, item_qty: e.target.value })}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 text-sm outline-none"
            />
          </div>
          <button
            onClick={handleAddStock}
            disabled={saving}
            className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal open={showBulk} onClose={() => setShowBulk(false)} title="Bulk Upload Stock" size="md">
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">
            Format CSV: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">stock_popup_id,item_sku,item_qty</code><br />
            Baris pertama adalah header, akan diabaikan.
          </p>
          <textarea
            value={bulkCsv}
            onChange={(e) => setBulkCsv(e.target.value)}
            rows={6}
            placeholder={"stock_popup_id,item_sku,item_qty\nPOP-001,SKU-001,10"}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm font-mono outline-none"
          />
          <button
            onClick={handleBulkUpload}
            disabled={saving}
            className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Memproses..." : "Upload"}
          </button>
        </div>
      </Modal>
    </div>
  );
}