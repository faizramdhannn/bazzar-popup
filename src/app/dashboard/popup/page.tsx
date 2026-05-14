"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2, Store } from "lucide-react";
import { SessionUser } from "@/types";

interface PopupRow {
  id_location: string;
  popup_name: string;
  popup_location: string;
}

export default function PopupPage() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser & { name: string };
  const router = useRouter();

  useEffect(() => {
    if (session && user?.role !== "admin") router.push("/dashboard");
  }, [session, user, router]);

  const [popups, setPopups] = useState<PopupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<PopupRow | null>(null);
  const [form, setForm] = useState({ popup_name: "", popup_location: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/popup");
    const data = await res.json();
    setPopups(data.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openAdd() {
    setEditTarget(null);
    setForm({ popup_name: "", popup_location: "" });
    setShowForm(true);
  }

  function openEdit(row: PopupRow) {
    setEditTarget(row);
    setForm({ popup_name: row.popup_name, popup_location: row.popup_location });
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/popup", {
      method: editTarget ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editTarget ? { ...form, id_location: editTarget.id_location } : form),
    });
    const data = await res.json();
    setSaving(false);
    setMsg(data.message || data.error);
    if (res.ok) { setShowForm(false); fetchData(); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus popup ini?")) return;
    const res = await fetch(`/api/popup?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    setMsg(data.message || data.error);
    fetchData();
  }

  const columns: ColumnDef<PopupRow, unknown>[] = [
    { header: "ID", accessorKey: "id_location" },
    { header: "Nama Popup", accessorKey: "popup_name" },
    { header: "Lokasi", accessorKey: "popup_location" },
    {
      header: "Aksi",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(row.original)} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => handleDelete(row.original.id_location)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
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
          <Store className="w-5 h-5" />
          <h1 className="text-xl font-semibold">Popup List</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah Popup
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
        <DataTable data={popups} columns={columns} />
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editTarget ? "Edit Popup" : "Tambah Popup"} size="sm">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Popup</label>
            <input
              value={form.popup_name}
              onChange={(e) => setForm({ ...form, popup_name: e.target.value })}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Lokasi</label>
            <input
              value={form.popup_location}
              onChange={(e) => setForm({ ...form, popup_location: e.target.value })}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm outline-none"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
