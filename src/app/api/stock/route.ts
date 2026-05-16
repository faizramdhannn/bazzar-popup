// src/app/api/stock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { readSheet, appendRow } from "@/lib/sheets";
import { nowIso } from "@/lib/utils";
import { SessionUser } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const popupId = searchParams.get("popup_id");

    const rows = await readSheet("master_data");
    const filtered = popupId ? rows.filter((r) => r.stock_popup_id === popupId) : rows;
    return NextResponse.json({ data: filtered });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser & { name: string };
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { stock_popup_id, item_sku, item_qty } = body;

    // Check if entry already exists
    const rows = await readSheet("master_data");
    const existingIdx = rows.findIndex(
      (r) => r.stock_popup_id === stock_popup_id && r.item_sku === item_sku
    );

    // Get master item info
    const items = await readSheet("master_item");
    const item = items.find((i) => i.item_sku === item_sku);
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const now = nowIso();

    if (existingIdx >= 0) {
      // Update existing qty
      const existing = rows[existingIdx];
      const newQty = Number(existing.item_qty) + Number(item_qty);
      const { updateRow } = await import("@/lib/sheets");
      await updateRow("master_data", existingIdx + 2, [
        existing.stock_popup_id,
        existing.item_sku,
        existing.item_name,
        existing.item_variant,
        newQty,
        existing.item_category,
        existing.item_hpj,
        existing.item_discount,
        existing.created_by,
        user.username,
        existing.created_at,
        now,
      ]);
    } else {
      await appendRow("master_data", [
        stock_popup_id,
        item_sku,
        item.item_name,
        item.item_variant,
        item_qty,
        item.item_category,
        item.item_hpj,
        0,
        user.username,
        user.username,
        now,
        now,
      ]);
    }

    return NextResponse.json({ message: "Stock updated" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
