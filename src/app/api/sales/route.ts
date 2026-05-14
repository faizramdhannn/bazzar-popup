// src/app/api/sales/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  readSheet,
  appendRow,
  updateRow,
  deleteRow,
  getNextSalesId,
  getNextDeliveryNoteId,
} from "@/lib/sheets";
import { SessionUser } from "@/types";

function nowIso() {
  return new Date().toISOString();
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await readSheet("sales_data");
    return NextResponse.json({ data: rows });
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
    const { sales_user_id, item_sku, item_qty } = body;

    const now = nowIso();
    const salesId = await getNextSalesId();
    const dnId = await getNextDeliveryNoteId();

    // Get item info
    const items = await readSheet("master_item");
    const item = items.find((i) => i.item_sku === item_sku);
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    // Reduce master_data stock
    const masterRows = await readSheet("master_data");
    const stockIdx = masterRows.findIndex(
      (r) => r.stock_popup_id === sales_user_id && r.item_sku === item_sku
    );
    if (stockIdx < 0) return NextResponse.json({ error: "Stock not found" }, { status: 404 });

    const currentQty = Number(masterRows[stockIdx].item_qty);
    if (currentQty < Number(item_qty)) {
      return NextResponse.json({ error: "Insufficient stock" }, { status: 400 });
    }

    const existing = masterRows[stockIdx];
    await updateRow("master_data", stockIdx + 2, [
      existing.stock_popup_id,
      existing.item_sku,
      existing.item_name,
      existing.item_variant,
      currentQty - Number(item_qty),
      existing.item_category,
      existing.item_hpj,
      existing.item_discount,
      existing.created_by,
      user.username,
      existing.created_at,
      now,
    ]);

    // Append sales_data
    await appendRow("sales_data", [
      sales_user_id,
      salesId,
      item_sku,
      item.item_name,
      item.item_variant,
      item_qty,
      dnId,
      user.username,
      user.username,
      now,
      now,
    ]);

    // Append delivery_note_sales
    await appendRow("delivery_note_sales", [
      dnId,
      item_sku,
      item.item_name,
      item_qty,
      user.username,
      user.username,
      now,
      now,
    ]);

    return NextResponse.json({ message: "Sale recorded", sales_id: salesId, dn: dnId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser & { name: string };
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const salesId = searchParams.get("sales_id");

    const rows = await readSheet("sales_data");
    const idx = rows.findIndex((r) => r.sales_id === salesId);
    if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Restore stock
    const sale = rows[idx];
    const masterRows = await readSheet("master_data");
    const stockIdx = masterRows.findIndex(
      (r) => r.stock_popup_id === sale.sales_user_id && r.item_sku === sale.item_sku
    );
    if (stockIdx >= 0) {
      const existing = masterRows[stockIdx];
      const restoredQty = Number(existing.item_qty) + Number(sale.item_qty);
      await updateRow("master_data", stockIdx + 2, [
        existing.stock_popup_id,
        existing.item_sku,
        existing.item_name,
        existing.item_variant,
        restoredQty,
        existing.item_category,
        existing.item_hpj,
        existing.item_discount,
        existing.created_by,
        user.username,
        existing.created_at,
        new Date().toISOString(),
      ]);
    }

    await deleteRow("sales_data", idx + 2);
    return NextResponse.json({ message: "Sale deleted and stock restored" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
