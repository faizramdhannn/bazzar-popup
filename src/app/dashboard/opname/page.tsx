"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2, ClipboardList, Eye, Pencil, ScanLine, CheckCircle2 } from "lucide-react";
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

interface PopupStore { id_location: string; popup_name: string; }
interface MasterItem { item_sku: string; item_name: string; item_variant: string; }

export default function OpnamePage() {
  const [groups, setGroups] = useState<OpnameGroup[]>([]);
  const [popups, setPopups] = useState<PopupStore[]>([]);
  const [items, setItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showSession, setShowSession] = useState(false);
  const [sessionPopup, setSessionPopup] = useState("");
  const [currentOpnameId, setCurrentOpnameId] = useState<string | null>(null);
  const [sessionItems, setSessionItems] = useState<OpnameDetail[]>([]);

  const [scanSku, setScanSku] = useState("");
  const [scanQty, setScanQty] = useState("1");
  const [lastScanned, setLastScanned] = useState<{ sku: string; name: string; qty: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");

  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [detail, setDetail] = useState<OpnameDetail[]>([]);
  const [editRow, setEditRow] = useState<OpnameDetail | null>(null);
  const [editQty, setEditQty] = useState("");
  const [saving, setSaving] = useState(false);

  const scanInputRef = useRef<HTMLInputElement>(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    const [oRes, pRes, iRes] = await Promise.all([
      fetch("/api/opname"), fetch("/api/popup"), fetch("/api/master-items"),
    ]);
    const [o, p, i] = await Promise.all([oRes.json(), pRes.json(), iRes.json()]);
    setGroups(o.data ?? []);
    setPopups(p.data ?? []);
    setItems(i.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  useEffect(() => {
    if (showSession && sessionPopup) {
      setTimeout(() => scanInputRef.current?.focus(), 150);
    }
  }, [showSession, sessionPopup]);

  function getPopupName(id: string) {
    return popups.find((p) => p.id_location === id)?.popup_name ?? id;
  }

  function getItemName(sku: string) {
    const item = items.find((i) => i.item_sku === sku);
    return item ? `${item.item_name} ${item.item_variant}`.trim() : null;
  }

  async function handleScan() {
    const sku = scanSku.trim();
    if (!sku || !sessionPopup) return;

    const itemName = getItemName(sku);
    if (!itemName) {
      setScanError(`SKU "${sku}" tidak ditemukan`);
      setScanSku("");
      scanInputRef.current?.focus();
      return;
    }

    setScanning(true);
    setScanError("");

    const res = await fetch("/api/opname", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        opname_user_id: sessionPopup,
        popup_id: sessionPopup,
        item_sku: sku,
        item_qty_real: Number(scanQty),
        opname_id: currentOpnameId,
      }),
    });
    const data = await res.json();
    setScanning(false);

    if (res.ok) {
      if (!currentOpnameId) setCurrentOpnameId(data.opname_id);

      setSessionItems((prev) => {
        const existing = prev.findIndex((r) => r.item_sku === sku);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = {
            ...updated[existing],
            item_qty: String(Number(updated[existing].item_qty) + Number(scanQty)),
          };
          return updated;
        }
        return [{
          opname_id: data.opname_id,
          popup_id: sessionPopup,
          item_sku: sku,
          item_name: itemName,
          item_qty: scanQty,
          item_cutoff_qty: "0",
          created_by: "",
          created_at: new Date().toISOString(),
        }, ...prev];
      });

      setLastScanned({ sku, name: itemName, qty: Number(scanQty) });
      setScanSku("");
      setScanQty("1");
      setTimeout(() => setLastScanned(null), 2500);
    } else {
      setScanError(data.error ?? "Gagal menyimpan");
    }

    scanInputRef.current?.focus();
  }

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
    setSaving(true);
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
    setSaving(false);
    setEditRow(null);
    fetchDetail(editRow.opname_id);
  }

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
    { header: "SKU", accessorKey: "item_sku" },
    { header: "Nama Item", accessorKey: "item_name" },
    { header: "Cutoff Qty", accessorKey: "item_cutoff_qty" },
    { header: "Real Qty", accessorKey: "item_qty" },
    {
      header: "Selisih", id: "diff",
      cell: ({ row }) => {
        const diff = Number(row.original.item_qty) - Number(row.original.item_cutoff_qty);
        return <span className={diff < 0 ? "text-red-500 font-medium" : diff > 0 ? "text-green-500 font-medium" : "text-zinc-400"}>{diff > 0 ? `+${diff}` : diff}</span>;
      },
    },
    {
      header: "Aksi", id: "actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => { setEditRow(row.original); setEditQty(row.original.item_qty); }} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => handleDeleteItem(row.original.opname_id, row.original.item_sku)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          <h1 className="text-xl font-semibold">Stock Opname</h1>
        </div>
        <button
          onClick={() => { setCurrentOpnameId(null); setSessionPopup(""); setSessionItems([]); setLastScanned(null); setScanSku(""); setScanQty("1"); setScanError(""); setShowSession(true); }}
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
      <Modal open={showSession} onClose={() => { setShowSession(false); fetchGroups(); }} title="Sesi Stock Opname" size="lg">
        <div className="space-y-4">

          {/* Pilih popup */}
          {!currentOpnameId && (
            <div>
              <label className="block text-sm font-medium mb-1">Pilih Popup</label>
              <select
                value={sessionPopup}
                onChange={(e) => setSessionPopup(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm outline-none"
              >
                <option value="">— pilih popup —</option>
                {popups.map((p) => <option key={p.id_location} value={p.id_location}>{p.popup_name}</option>)}
              </select>
            </div>
          )}

          {/* Badge sesi aktif */}
          {currentOpnameId && (
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              <span><span className="font-semibold">{currentOpnameId}</span> — {getPopupName(sessionPopup)}</span>
              <span className="ml-auto text-zinc-400">{sessionItems.length} item terscan</span>
            </div>
          )}

          {/* Input scan — fokus utama */}
          {sessionPopup && (
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                <ScanLine className="w-3.5 h-3.5" /> Scan Barcode / Ketik SKU
              </label>
              <div className="flex gap-2">
                <input
                  ref={scanInputRef}
                  value={scanSku}
                  onChange={(e) => { setScanSku(e.target.value); setScanError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleScan()}
                  placeholder="Arahkan scanner atau ketik SKU, lalu Enter..."
                  disabled={scanning}
                  autoComplete="off"
                  className="flex-1 rounded-xl border-2 border-zinc-900 dark:border-zinc-100 bg-white dark:bg-zinc-900 px-4 py-3 text-base font-mono outline-none focus:ring-2 focus:ring-zinc-900/30 dark:focus:ring-zinc-100/30 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
                />
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-zinc-400 text-center">Qty</label>
                  <input
                    type="number" min="1"
                    value={scanQty}
                    onChange={(e) => setScanQty(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleScan()}
                    className="w-16 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-3 text-base text-center outline-none"
                  />
                </div>
                <button
                  onClick={handleScan}
                  disabled={scanning || !scanSku.trim()}
                  className="self-end px-5 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-sm font-semibold disabled:opacity-40 hover:opacity-90"
                >
                  {scanning ? "..." : "OK"}
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {scanError && (
            <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              ⚠ {scanError}
            </div>
          )}

          {/* Last scanned feedback */}
          {lastScanned && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400 animate-pulse">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              ✓ <span className="font-mono font-semibold">{lastScanned.sku}</span> — {lastScanned.name}
              {lastScanned.qty > 1 && <span className="ml-auto font-semibold">×{lastScanned.qty}</span>}
            </div>
          )}

          {/* Live list hasil scan */}
          {sessionItems.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 sticky top-0">
                  <tr>
                    {["SKU", "Nama Item", "Qty"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-zinc-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {sessionItems.map((r, idx) => (
                    <tr key={r.item_sku} className={idx === 0 ? "bg-green-50 dark:bg-green-900/10" : "bg-white dark:bg-zinc-900"}>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-500">{r.item_sku}</td>
                      <td className="px-3 py-2">{r.item_name}</td>
                      <td className="px-3 py-2 font-bold">{r.item_qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => { setShowSession(false); fetchGroups(); }}
              className="px-5 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Selesai & Tutup
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={`Detail Opname: ${showDetail}`} size="lg">
        <DataTable data={detail} columns={detailColumns} />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editRow} onClose={() => setEditRow(null)} title="Edit Qty Real" size="sm">
        {editRow && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500">
              <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{editRow.item_sku}</span>
              <span className="ml-2">{editRow.item_name}</span>
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Qty Real</label>
              <input
                type="number" min="0"
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEditSave()}
                autoFocus
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm outline-none"
              />
            </div>
            <button onClick={handleEditSave} disabled={saving} className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}