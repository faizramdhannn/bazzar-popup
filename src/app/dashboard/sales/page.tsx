"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2, ShoppingCart, ClipboardPaste } from "lucide-react";
import { SessionUser } from "@/types";
import { formatDate } from "@/lib/utils";

interface SalesRow {
  sales_user_id: string;
  sales_id: string;
  item_sku: string;
  item_name: string;
  item_category: string;
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
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [msg, setMsg] = useState("");

  const [qtyPasteActive, setQtyPasteActive] = useState(false);
  const [qtyPasteText, setQtyPasteText] = useState("");

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
    setBulkErrors([]);

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

  function handleScanPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    const lines = text
      .split(/[\n\r]+/)
      .map((l) => l.trim().toUpperCase())
      .filter(Boolean);

    if (lines.length <= 1) return;

    e.preventDefault();
    setScanSku("");
    setScanError("");
    setBulkErrors([]);

    const errors: string[] = [];
    const newItems: SessionItem[] = [];

    for (const sku of lines) {
      const found = resolveItem(sku);
      if (!found) { errors.push(sku); continue; }
      const itemName = [found.item_name, found.item_category].filter(Boolean).join(" — ").trim();
      const existing = newItems.findIndex((r) => r.item_sku === sku);
      if (existing >= 0) {
        newItems[existing].item_qty += 1;
      } else {
        newItems.push({ item_sku: sku, item_name: itemName, item_qty: 1 });
      }
    }

    if (newItems.length > 0) {
      setSessionItems((prev) => {
        const merged = [...newItems];
        for (const p of prev) {
          const idx = merged.findIndex((r) => r.item_sku === p.item_sku);
          if (idx >= 0) {
            merged[idx].item_qty += p.item_qty;
          } else {
            merged.push(p);
          }
        }
        return merged;
      });
      setLastScanned(`${newItems.length} SKU ditambahkan`);
      setTimeout(() => setLastScanned(null), 2500);
    }

    if (errors.length > 0) setBulkErrors(errors);
    scanInputRef.current?.focus();
  }

  function handleQtyPasteApply() {
    const lines = qtyPasteText
      .split(/[\n\r]+/)
      .map((l) => l.trim())
      .filter(Boolean);

    setSessionItems((prev) => {
      const updated = [...prev];
      lines.forEach((val, idx) => {
        const qty = parseInt(val, 10);
        if (idx < updated.length && !isNaN(qty) && qty >= 0) {
          updated[idx] = { ...updated[idx], item_qty: qty };
        }
      });
      return updated;
    });

    setQtyPasteText("");
    setQtyPasteActive(false);
  }

  function handleQtyChange(sku: string, val: string) {
    const qty = parseInt(val, 10);
    if (isNaN(qty) || qty < 0) return;
    setSessionItems((prev) =>
      prev.map((r) => r.item_sku === sku ? { ...r, item_qty: qty } : r)
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
      const res = await fetch("/api/sales/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sales_user_id: sessionPopup,
          items: sessionItems.map((i) => ({ item_sku: i.item_sku, item_qty: i.item_qty })),
        }),
      });

      const data: {
        message?: string;
        results?: { sales_id: string; dn: string; item_sku: string }[];
        errors?: { item_sku: string; error: string }[];
        error?: string;
      } = await res.json();

      if (!res.ok) {
        if (data.errors && data.errors.length > 0) {
          setSaveError(data.errors.map((e) => `${e.item_sku}: ${e.error}`).join("\n"));
        } else {
          setSaveError(data.error ?? "Gagal menyimpan");
        }
        return;
      }

      const dns = data.results?.map((r) => r.dn).join(", ") ?? "";
      setMsg(`${data.message}. DN: ${dns}`);
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
    setBulkErrors([]);
    setSaveError("");
    setLastScanned(null);
    setQtyPasteActive(false);
    setQtyPasteText("");
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
    { header: "Kategori", accessorKey: "item_category" },
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

  const totalUnits = sessionItems.reduce((s, r) => s + r.item_qty, 0);

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
            <label className="block text-xs font-medium text-zinc-500 mb-1">
              Scan Barcode
            </label>
            <div className="flex gap-2">
              <input
                ref={scanInputRef}
                value={scanSku}
                onChange={(e) => { setScanSku(e.target.value.toUpperCase()); setScanError(""); setBulkErrors([]); }}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                onPaste={handleScanPaste}
                placeholder="Scan / paste SKU, lalu Enter..."
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
                ✓ <span className="font-mono font-semibold">{lastScanned}</span>
              </p>
            )}
            {bulkErrors.length > 0 && (
              <div className="mt-1.5 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-0.5">
                  {bulkErrors.length} SKU tidak ditemukan:
                </p>
                <p className="text-xs font-mono text-red-500 break-all">{bulkErrors.join(", ")}</p>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-zinc-400">{sessionItems.length} SKU · {totalUnits} unit</p>
              {sessionItems.length > 0 && (
                <button
                  onClick={() => { setQtyPasteActive((v) => !v); setQtyPasteText(""); }}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                >
                  <ClipboardPaste className="w-3 h-3" />
                  Paste Qty
                </button>
              )}
            </div>

            {qtyPasteActive && (
              <div className="mb-2 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 space-y-2">
                <p className="text-xs text-zinc-500">
                  Paste angka qty (satu per baris) — diisi ke baris dari atas ke bawah.
                </p>
                <textarea
                  autoFocus
                  value={qtyPasteText}
                  onChange={(e) => setQtyPasteText(e.target.value)}
                  rows={4}
                  placeholder={"5\n3\n10\n2"}
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-2 text-sm font-mono outline-none resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleQtyPasteApply}
                    disabled={!qtyPasteText.trim()}
                    className="px-3 py-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium disabled:opacity-40"
                  >
                    Terapkan
                  </button>
                  <button
                    onClick={() => { setQtyPasteActive(false); setQtyPasteText(""); }}
                    className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-zinc-400 w-7">No.</th>
                      <th className="px-2 py-1.5 text-left font-medium text-zinc-400">Item Code</th>
                      <th className="px-2 py-1.5 text-left font-medium text-zinc-400">Item Name</th>
                      <th className="px-2 py-1.5 text-right font-medium text-zinc-400 w-16">Qty</th>
                      <th className="px-2 py-1.5 w-7"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {sessionItems.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-8 text-center text-zinc-400">No Data</td></tr>
                    ) : (
                      sessionItems.map((r, idx) => (
                        <tr key={r.item_sku} className="group">
                          <td className="px-2 py-1.5 text-zinc-400 text-center">{idx + 1}</td>
                          <td className="px-2 py-1.5 font-mono text-zinc-500 dark:text-zinc-400">{r.item_sku}</td>
                          <td className="px-2 py-1.5 text-zinc-600 dark:text-zinc-300 truncate max-w-[140px]">{r.item_name}</td>
                          <td className="px-2 py-1.5 text-right">
                            <input
                              type="number"
                              min="1"
                              value={r.item_qty}
                              onChange={(e) => handleQtyChange(r.item_sku, e.target.value)}
                              className="w-14 text-right font-medium tabular-nums bg-transparent border border-transparent focus:border-zinc-300 dark:focus:border-zinc-600 rounded px-1 py-0.5 outline-none focus:bg-white dark:focus:bg-zinc-900 transition-colors"
                            />
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <button onClick={() => handleRemoveItem(r.item_sku)} className="p-1 rounded text-zinc-300 hover:text-red-500 transition-colors">
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

          {saveError && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-600 dark:text-red-400 whitespace-pre-line">{saveError}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setShowAdd(false)}
              className="flex-1 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving || sessionItems.length === 0 || !sessionPopup}
              className="flex-1 py-2.5 text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Menyimpan..." : `Simpan (${sessionItems.length} SKU)`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}