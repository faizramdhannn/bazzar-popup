// src/app/api/opname/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { readSheet, appendRow, updateRow, deleteRow, getNextOpnameId } from "@/lib/sheets";
import { SessionUser } from "@/types";

function nowIso() {
  return new Date().toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const opnameId = searchParams.get("opname_id");

    const rows = await readSheet("stock_opname");
    if (opnameId) {
      return NextResponse.json({ data: rows.filter((r) => r.opname_id === opnameId) });
    }

    // Group by opname_id for list view
    const grouped: Record<string, { opname_id: string; date: string; popup_id: string; total_items: number; created_by: string }> = {};
    for (const row of rows) {
      if (!grouped[row.opname_id]) {
        grouped[row.opname_id] = {
          opname_id: row.opname_id,
          date: row.created_at,
          popup_id: row.popup_id,
          total_items: 0,
          created_by: row.created_by,
        };
      }
      grouped[row.opname_id].total_items++;
    }

    return NextResponse.json({ data: Object.values(grouped) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser & { name: string };
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { opname_user_id, popup_id, item_sku, item_qty_real, opname_id: existingOpnameId } = body;

    const now = nowIso();
    const opnameId = existingOpnameId || (await getNextOpnameId());

    // Get cutoff qty from master_data
    const masterRows = await readSheet("master_data");
    const stockEntry = masterRows.find(
      (r) => r.stock_popup_id === popup_id && r.item_sku === item_sku
    );
    const cutoffQty = stockEntry ? Number(stockEntry.item_qty) : 0;

    // Get item info
    const items = await readSheet("master_item");
    const item = items.find((i) => i.item_sku === item_sku);
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    await appendRow("stock_opname", [
      opname_user_id,
      opnameId,
      popup_id,
      item_sku,
      item.item_name,
      item_qty_real,
      cutoffQty,
      user.username,
      user.username,
      now,
      now,
    ]);

    return NextResponse.json({ message: "Opname entry added", opname_id: opnameId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser & { name: string };
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { opname_user_id, opname_id, item_sku, item_qty_real } = body;

    const rows = await readSheet("stock_opname");
    const idx = rows.findIndex(
      (r) => r.opname_id === opname_id && r.item_sku === item_sku
    );
    if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const existing = rows[idx];
    await updateRow("stock_opname", idx + 2, [
      opname_user_id,
      opname_id,
      existing.popup_id,
      item_sku,
      existing.item_name,
      item_qty_real,
      existing.item_cutoff_qty,
      existing.created_by,
      user.username,
      existing.created_at,
      new Date().toISOString(),
    ]);

    return NextResponse.json({ message: "Opname updated" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const opnameId = searchParams.get("opname_id");
    const itemSku = searchParams.get("item_sku");

    const rows = await readSheet("stock_opname");

    if (itemSku) {
      // Delete single item
      const idx = rows.findIndex((r) => r.opname_id === opnameId && r.item_sku === itemSku);
      if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
      await deleteRow("stock_opname", idx + 2);
    } else {
      // Delete entire opname session (all items with same opname_id)
      const indices = rows
        .map((r, i) => (r.opname_id === opnameId ? i : -1))
        .filter((i) => i >= 0)
        .sort((a, b) => b - a); // Delete from bottom up
      for (const i of indices) {
        await deleteRow("stock_opname", i + 2);
      }
    }

    return NextResponse.json({ message: "Deleted" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
