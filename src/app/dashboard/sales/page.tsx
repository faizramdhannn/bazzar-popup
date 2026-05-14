"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2, ShoppingCart, Minus } from "lucide-react";
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
interface MasterItem { item_sku: string; item_name: string; item_category: string; }
interface SessionItem { item_sku: string; item_name: string; item_qty: number; }

export default function SalesPage() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser & { name: string };
  const isAdmin = user?.role === "admin";

  const [sales, setSales] = useState<SalesRow[]>([]);
  const [popups, setPopups] = useState<PopupStore[]>([]);
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [sessionPopup, setSessionPopup] = useState("");
  const [sessionItems, setSessionItems] = useState<SessionItem[]>([]);
  const [scanSku, setScanSku] = useState("");
  const [scanError, setScanError] = useState("");
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [msg, setMsg] = useState("");

  const scanInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [sRes, pRes, iRes] = await Promise.all([
      fetch("/api/sales"), fetch("/api/popup"), fetch("/api/master-items"),
    ]);
    const [s, p, i] = await Promise.all([sRes.json(), pRes.json(), iRes.json()]);
    setSales(s.data ?? []);
    setPopups(p.data ?? []);
    setMasterItems(i.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (showAdd && sessionPopup) {
      setTimeout(() => scanInputRef.current?.focus(), 300);
    }
  }, [showAdd, sessionPopup]);

  function resolveItem(sku: string): MasterItem | undefined {
    return masterItems.find((i) => i.item_sku === sku.toUpperCase());
  }

  function handleScan() {
    const sku = scanSku.trim().toUpperCase();
    if (!sku || !sessionPopup) return;
    setScanError("");

    const found = resolveItem(sku);
    if (!found) {
      setScanError(`SKU "${sku}" tidak ditemukan`);
      setScanSku("");
      scanInputRef.current?.focus();
      return;
    }

    const itemName = [found.item_name, found.item_category].filter(Boolean).join(" — ").trim();
    setSessionItems((prev) => {
      const idx = prev.findIndex((r) => r.item_sku === sku);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], item_qty: updated[idx].item_qty + 1 };
        const [row] = updated.splice(idx, 1);
        return [row, ...updated];
      }
      return [{ item_sku: sku, item_name: itemName, item_qty: 1 }, ...prev];
    });

    setLastScanned(sku);
    setScanSku("");
    setTimeout(() => setLastScanned(null), 1500);
    scanInputRef.current?.focus();
  }

  function handleQtyChange(sku: string, delta: number) {
    setSessionItems((prev) =>
      prev.map((r) => r.item_sku === sku ? { ...r, item_qty: Math.max(1, r.item_qty + delta) } : r)
    );
  }

  function handleRemoveItem(sku: string) {
    setSessionItems((prev) => prev.filter((r) => r.item_sku !== sku));
  }

  async function handleSave() {
    if (!sessionPopup || sessionItems.length === 0) return;
    setSaving(true);
    setSaveError("");
    try {
      const results: string[] = [];
      for (const item of [...sessionItems].reverse()) {
        const res: Response = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sales_user_id: sessionPopup, item_sku: item.item_sku, item_qty: item.item_qty }),
        });
        const data: { error?: string; dn?: string } = await res.json();
        if (!res.ok) throw new Error(`${item.item_sku}: ${data.error ?? "Gagal"}`);
        if (data.dn) results.push(data.dn);
      }
      setMsg(`Penjualan disimpan. DN: ${results.join(", ")}`);
      setShowAdd(false);
      setSessionItems([]);
      setSessionPopup("");
      setScanSku("");
      fetchData();
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  }

  function startNewSession() {
    setSessionItems([]);
    setSessionPopup("");
    setScanSku("");
    setScanError("");
    setSaveError("");
    setLastScanned(null);
    setShowAdd(true);
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
    { header: "DN", accessorKey: "delivery_note" },
    { header: "Oleh", accessorKey: "created_by" },
    { header: "Tanggal", accessorKey: "created_at", cell: ({ row }) => formatDate(row.original.created_at) },
    ...(isAdmin ? [{
      header: "Aksi", id: "actions",
      cell: ({ row }: { row: { original: SalesRow } }) => (
        <button onClick={() => handleDelete(row.original.sales_id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ),
    } as ColumnDef<SalesRow, unknown>] : []),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5 md:mb-6">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          <h1 className="text-lg md:text-xl font-semibold">Sales</h1>
        </div>
        <button
          onClick={startNewSession}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Tambah Penjualan</span>
          <span className="sm:hidden">Tambah</span>
        </button>
      </div>

      {msg && (
        <div className="mb-4 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm">
          {msg}
          <button onClick={() => setMsg("")} className="ml-3 text-zinc-400">×</button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-400 py-8 text-center">Memuat data...</div>
      ) : (
        <DataTable data={sales} columns={columns} />
      )}

      {/* Add Sales Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Tambah Penjualan" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Popup</label>
            <select
              value={sessionPopup}
              onChange={(e) => { setSessionPopup(e.target.value); setScanError(""); }}
              disabled={sessionItems.length > 0}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 text-sm outline-none disabled:opacity-50"
            >
              <option value="">— pilih popup —</option>
              {popups.map((p) => (
                <option key={p.id_location} value={p.id_location}>{p.popup_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Scan Barcode</label>
            <div className="flex gap-2">
              <input
                ref={scanInputRef}
                value={scanSku}
                onChange={(e) => { setScanSku(e.target.value.toUpperCase()); setScanError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                placeholder="Scan SKU, lalu Enter..."
                disabled={!sessionPopup}
                autoComplete="off"
                spellCheck={false}
                className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 disabled:opacity-40"
              />
              <button
                onClick={handleScan}
                disabled={!sessionPopup || !scanSku.trim()}
                className="px-3 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium disabled:opacity-40 sm:hidden"
              >
                +
              </button>
            </div>
            {scanError && <p className="mt-1 text-xs text-red-500">{scanError}</p>}
            {lastScanned && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                ✓ <span className="font-mono font-semibold">{lastScanned}</span> ditambahkan
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-500 mb-1">
              Items ({sessionItems.length} SKU · {sessionItems.reduce((s, r) => s + r.item_qty, 0)} unit)
            </p>
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="max-h-52 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-zinc-400 w-8">#</th>
                      <th className="px-2 py-2 text-left font-medium text-zinc-400">SKU / Nama</th>
                      <th className="px-2 py-2 text-center font-medium text-zinc-400 w-28">Qty</th>
                      <th className="px-2 py-2 w-6"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {sessionItems.length === 0 ? (
                      <tr><td colSpan={4} className="px-3 py-8 text-center text-zinc-400">No Data</td></tr>
                    ) : (
                      sessionItems.map((r, idx) => (
                        <tr key={r.item_sku} className="bg-white dark:bg-zinc-900">
                          <td className="px-2 py-2 text-zinc-400 text-center">{idx + 1}</td>
                          <td className="px-2 py-2">
                            <div className="font-mono text-zinc-500">{r.item_sku}</div>
                            <div className="text-zinc-400 truncate max-w-[140px]">{r.item_name}</div>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => handleQtyChange(r.item_sku, -1)} className="w-6 h-6 flex items-center justify-center rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400">
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="font-semibold w-6 text-center tabular-nums">{r.item_qty}</span>
                              <button onClick={() => handleQtyChange(r.item_sku, +1)} className="w-6 h-6 flex items-center justify-center rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400">
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-1 py-2 text-center">
                            <button onClick={() => handleRemoveItem(r.item_sku)} className="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {saveError && <p className="text-xs text-red-500">{saveError}</p>}

          <div className="flex gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving || sessionItems.length === 0 || !sessionPopup}
              className="flex-1 py-2.5 text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}