// src/app/api/stock/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { readSheet, appendRow, updateRow } from "@/lib/sheets";
import { SessionUser } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser & { name: string };
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { items } = body as {
      items: { stock_popup_id: string; item_sku: string; item_qty: number }[];
    };

    const masterRows = await readSheet("master_data");
    const itemRows = await readSheet("master_item");
    const now = new Date().toISOString();
    let added = 0;
    let updated = 0;

    for (const entry of items) {
      const existingIdx = masterRows.findIndex(
        (r) => r.stock_popup_id === entry.stock_popup_id && r.item_sku === entry.item_sku
      );
      const item = itemRows.find((i) => i.item_sku === entry.item_sku);
      if (!item) continue;

      if (existingIdx >= 0) {
        const existing = masterRows[existingIdx];
        const newQty = Number(existing.item_qty) + Number(entry.item_qty);
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
        masterRows[existingIdx].item_qty = String(newQty);
        updated++;
      } else {
        await appendRow("master_data", [
          entry.stock_popup_id,
          entry.item_sku,
          item.item_name,
          item.item_variant,
          entry.item_qty,
          item.item_category,
          item.item_hpj,
          0,
          user.username,
          user.username,
          now,
          now,
        ]);
        added++;
      }
    }

    return NextResponse.json({ message: `Bulk done: ${added} added, ${updated} updated` });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
