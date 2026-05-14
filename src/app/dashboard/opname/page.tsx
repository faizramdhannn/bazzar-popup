"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2, ClipboardList, Eye, Pencil, Minus } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface OpnameGroup {
  opname_id: string;
  date: string;
  popup_id: string;
  total_items: number;
  created_by: string;
}

interface OpnameDetail {
  opname_id: string;
  popup_id: string;
  item_sku: string;
  item_name: string;
  item_qty: string;
  item_cutoff_qty: string;
  created_by: string;
  created_at: string;
}

interface SessionItem {
  item_sku: string;
  item_name: string;
  real_scan: number;
}

interface PopupStore { id_location: string; popup_name: string; }
interface MasterItem { item_sku: string; item_name: string; item_category: string; }

export default function OpnamePage() {
  const [groups, setGroups] = useState<OpnameGroup[]>([]);
  const [popups, setPopups] = useState<PopupStore[]>([]);
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showSession, setShowSession] = useState(false);
  const [sessionPopup, setSessionPopup] = useState("");
  const [sessionItems, setSessionItems] = useState<SessionItem[]>([]);

  const [scanSku, setScanSku] = useState("");
  const [scanError, setScanError] = useState("");
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [detail, setDetail] = useState<OpnameDetail[]>([]);
  const [editRow, setEditRow] = useState<OpnameDetail | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const scanInputRef = useRef<HTMLInputElement>(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    const [oRes, pRes, iRes] = await Promise.all([
      fetch("/api/opname"), fetch("/api/popup"), fetch("/api/master-items"),
    ]);
    const [o, p, i] = await Promise.all([oRes.json(), pRes.json(), iRes.json()]);
    setGroups(o.data ?? []);
    setPopups(p.data ?? []);
    setMasterItems(i.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  useEffect(() => {
    if (showSession && sessionPopup) {
      setTimeout(() => scanInputRef.current?.focus(), 100);
    }
  }, [showSession, sessionPopup]);

  function getPopupName(id: string) {
    return popups.find((p) => p.id_location === id)?.popup_name ?? id;
  }

  function resolveItem(sku: string): MasterItem | undefined {
    return masterItems.find((i) => i.item_sku === sku.toUpperCase());
  }

  // ── Scan → lokal saja ────────────────────────────────────────
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
        updated[idx] = { ...updated[idx], real_scan: updated[idx].real_scan + 1 };
        const [row] = updated.splice(idx, 1);
        return [row, ...updated];
      }
      return [{ item_sku: sku, item_name: itemName, real_scan: 1 }, ...prev];
    });

    setLastScanned(sku);
    setScanSku("");
    setTimeout(() => setLastScanned(null), 1500);
    scanInputRef.current?.focus();
  }

  function handleQtyChange(sku: string, delta: number) {
    setSessionItems((prev) =>
      prev.map((r) =>
        r.item_sku === sku ? { ...r, real_scan: Math.max(1, r.real_scan + delta) } : r
      )
    );
  }

  function handleRemoveItem(sku: string) {
    setSessionItems((prev) => prev.filter((r) => r.item_sku !== sku));
  }

  // ── Save semua ke server ─────────────────────────────────────
  async function handleSave() {
    if (!sessionPopup || sessionItems.length === 0) return;
    setSaving(true);
    setSaveError("");
    try {
      let opnameId: string | null = null;
      for (const item of [...sessionItems].reverse()) {
        const res: Response = await fetch("/api/opname", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opname_user_id: sessionPopup,
            popup_id: sessionPopup,
            item_sku: item.item_sku,
            item_qty_real: item.real_scan,
            opname_id: opnameId,
          }),
        });
        const data: { error?: string; opname_id?: string } = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan");
        if (!opnameId) opnameId = data.opname_id ?? null;
      }
      setShowSession(false);
      setSessionItems([]);
      setSessionPopup("");
      setScanSku("");
      fetchGroups();
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  }

  // ── Detail ───────────────────────────────────────────────────
  async function fetchDetail(opnameId: string) {
    const res = await fetch(`/api/opname?opname_id=${opnameId}`);
    const data = await res.json();
    setDetail(data.data ?? []);
    setShowDetail(opnameId);
  }

  async function handleDeleteItem(opnameId: string, itemSku: string) {
    if (!confirm("Hapus item ini?")) return;
    await fetch(`/api/opname?opname_id=${opnameId}&item_sku=${itemSku}`, { method: "DELETE" });
    fetchDetail(opnameId);
    fetchGroups();
  }

  async function handleDeleteGroup(opnameId: string) {
    if (!confirm("Hapus seluruh sesi opname ini?")) return;
    await fetch(`/api/opname?opname_id=${opnameId}`, { method: "DELETE" });
    fetchGroups();
  }

  async function handleEditSave() {
    if (!editRow) return;
    setEditSaving(true);
    await fetch("/api/opname", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        opname_user_id: editRow.popup_id,
        opname_id: editRow.opname_id,
        item_sku: editRow.item_sku,
        item_qty_real: Number(editQty),
      }),
    });
    setEditSaving(false);
    setEditRow(null);
    fetchDetail(editRow.opname_id);
  }

  function startNewSession() {
    setSessionItems([]);
    setSessionPopup("");
    setScanSku("");
    setScanError("");
    setSaveError("");
    setLastScanned(null);
    setShowSession(true);
  }

  // ── Columns ──────────────────────────────────────────────────
  const groupColumns: ColumnDef<OpnameGroup, unknown>[] = [
    { header: "Opname ID", accessorKey: "opname_id" },
    { header: "Popup", accessorKey: "popup_id", cell: ({ row }) => getPopupName(row.original.popup_id) },
    { header: "Tanggal", accessorKey: "date", cell: ({ row }) => formatDate(row.original.date) },
    { header: "Total Item", accessorKey: "total_items" },
    { header: "Dibuat Oleh", accessorKey: "created_by" },
    {
      header: "Aksi", id: "actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => fetchDetail(row.original.opname_id)} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => handleDeleteGroup(row.original.opname_id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const detailColumns: ColumnDef<OpnameDetail, unknown>[] = [
    {
      header: "No.", id: "no",
      cell: ({ row }) => <span className="text-zinc-400">{row.index + 1}</span>,
    },
    { header: "Item Code", accessorKey: "item_sku" },
    { header: "Item Name", accessorKey: "item_name" },
    { header: "Real Scan", accessorKey: "item_qty" },
    { header: "Cutoff", accessorKey: "item_cutoff_qty" },
    {
      header: "Selisih", id: "diff",
      cell: ({ row }) => {
        const diff = Number(row.original.item_qty) - Number(row.original.item_cutoff_qty);
        return (
          <span className={diff < 0 ? "text-red-500 font-medium" : diff > 0 ? "text-green-500 font-medium" : "text-zinc-400"}>
            {diff > 0 ? `+${diff}` : diff}
          </span>
        );
      },
    },
    {
      header: "Aksi", id: "actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button
            onClick={() => { setEditRow(row.original); setEditQty(row.original.item_qty); }}
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDeleteItem(row.original.opname_id, row.original.item_sku)}
            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  // ── Render ───────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          <h1 className="text-xl font-semibold">Stock Opname</h1>
        </div>
        <button
          onClick={startNewSession}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" /> Mulai Opname
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-400 py-8 text-center">Memuat data...</div>
      ) : (
        <DataTable data={groups} columns={groupColumns} />
      )}

      {/* ── Scan Session Modal ── */}
      <Modal
        open={showSession}
        onClose={() => setShowSession(false)}
        title="Sesi Stock Opname"
        size="lg"
      >
        <div className="space-y-4">

          {/* Popup selector */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Popup</label>
            <select
              value={sessionPopup}
              onChange={(e) => { setSessionPopup(e.target.value); setScanError(""); }}
              disabled={sessionItems.length > 0}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm outline-none disabled:opacity-50"
            >
              <option value="">— pilih popup —</option>
              {popups.map((p) => (
                <option key={p.id_location} value={p.id_location}>{p.popup_name}</option>
              ))}
            </select>
          </div>

          {/* Scan input */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Scan Barcode</label>
            <input
              ref={scanInputRef}
              value={scanSku}
              onChange={(e) => { setScanSku(e.target.value.toUpperCase()); setScanError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              placeholder="Scan atau ketik SKU, lalu Enter..."
              disabled={!sessionPopup}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 disabled:opacity-40 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
            />
            {scanError && <p className="mt-1 text-xs text-red-500">{scanError}</p>}
            {lastScanned && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                ✓ <span className="font-mono font-semibold">{lastScanned}</span> ditambahkan
              </p>
            )}
          </div>

          {/* Items table */}
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-1">Items</p>
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400 w-10">No.</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400 w-32">Item Code</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Item Name</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-zinc-400 w-32">Real Scan</th>
                      <th className="px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {sessionItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-10 text-center text-xs text-zinc-400">
                          No Data
                        </td>
                      </tr>
                    ) : (
                      sessionItems.map((r, idx) => (
                        <tr key={r.item_sku} className="bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                          <td className="px-3 py-2 text-xs text-zinc-400 text-center">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono text-xs text-zinc-500">{r.item_sku}</td>
                          <td className="px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">{r.item_name}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleQtyChange(r.item_sku, -1)}
                                className="w-5 h-5 flex items-center justify-center rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="text-xs font-semibold w-6 text-center tabular-nums">
                                {r.real_scan}
                              </span>
                              <button
                                onClick={() => handleQtyChange(r.item_sku, +1)}
                                className="w-5 h-5 flex items-center justify-center rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => handleRemoveItem(r.item_sku)}
                              className="p-1 rounded text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
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

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-xs text-zinc-400">
              {sessionItems.length} SKU &middot; {sessionItems.reduce((s, r) => s + r.real_scan, 0)} unit
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSession(false)}
                className="px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || sessionItems.length === 0 || !sessionPopup}
                className="px-4 py-2 text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:opacity-90 disabled:opacity-40"
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Detail Modal ── */}
      <Modal
        open={!!showDetail}
        onClose={() => setShowDetail(null)}
        title={`Detail Opname: ${showDetail}`}
        size="lg"
      >
        <DataTable data={detail} columns={detailColumns} />
      </Modal>

      {/* ── Edit Qty Modal ── */}
      <Modal open={!!editRow} onClose={() => setEditRow(null)} title="Edit Real Scan" size="sm">
        {editRow && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                {editRow.item_sku}
              </span>
              <span className="text-zinc-600 dark:text-zinc-300">{editRow.item_name}</span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Real Scan</label>
              <input
                type="number"
                min="0"
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEditSave()}
                autoFocus
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm outline-none"
              />
            </div>
            <button
              onClick={handleEditSave}
              disabled={editSaving}
              className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {editSaving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}