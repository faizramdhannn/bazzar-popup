// src/app/api/sales/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  batchReadSheets,
  batchUpdateRows,
  batchAppendRows,
  generateSalesIds,
  generateDeliveryNoteIds,
} from "@/lib/sheets";
import { SessionUser } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser & { name: string };
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { sales_user_id, items } = body as {
      sales_user_id: string;
      items: { item_sku: string; item_qty: number }[];
    };

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // READ: 1 batch call for all 4 sheets
    const [masterItems, masterRows, salesRows, dnRows] = await batchReadSheets([
      { sheetName: "master_item" },
      { sheetName: "master_data" },
      { sheetName: "sales_data" },
      { sheetName: "delivery_note_sales" },
    ]);

    const itemMap = new Map(masterItems.map((i) => [i.item_sku, i]));
    const stockMap = new Map(
      masterRows.map((r, idx) => [
        `${r.stock_popup_id}::${r.item_sku}`,
        { row: r, idx },
      ])
    );

    const salesIds = generateSalesIds(salesRows, items.length);
    const dnIds = generateDeliveryNoteIds(dnRows, items.length);

    // VALIDATE
    const errors: { item_sku: string; error: string }[] = [];
    const updatedQtys = new Map<string, number>();

    for (const item of items) {
      const sku = item.item_sku.toUpperCase();
      if (!itemMap.has(sku)) {
        errors.push({ item_sku: sku, error: "Item not found in master_item" });
        continue;
      }
      const stockKey = `${sales_user_id}::${sku}`;
      const stockEntry = stockMap.get(stockKey);
      if (!stockEntry) {
        errors.push({ item_sku: sku, error: "Stock not found for this popup" });
        continue;
      }
      const current = updatedQtys.has(stockKey)
        ? updatedQtys.get(stockKey)!
        : Number(stockEntry.row.item_qty);
      if (current < item.item_qty) {
        errors.push({ item_sku: sku, error: `Insufficient stock (available: ${current})` });
        continue;
      }
      updatedQtys.set(stockKey, current - item.item_qty);
    }

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // WRITE 1: batch update master_data stock (1 API call)
    const stockUpdates = Array.from(updatedQtys.entries()).map(([stockKey, newQty]) => {
      const { row, idx } = stockMap.get(stockKey)!;
      return {
        rowIndex: idx + 2,
        values: [
          row.stock_popup_id, row.item_sku, row.item_name, row.item_variant,
          newQty, row.item_category, row.item_hpj, row.item_discount,
          row.created_by, user.username, row.created_at, now,
        ] as (string | number)[],
      };
    });
    await batchUpdateRows("master_data", stockUpdates);

    // WRITE 2: batch append sales_data (1 API call)
    await batchAppendRows("sales_data", items.map((item, i) => {
      const sku = item.item_sku.toUpperCase();
      const m = itemMap.get(sku)!;
      return [sales_user_id, salesIds[i], sku, m.item_name, m.item_variant ?? "",
        item.item_qty, dnIds[i], user.username, user.username, now, now] as (string | number)[];
    }));

    // WRITE 3: batch append delivery_note_sales (1 API call)
    await batchAppendRows("delivery_note_sales", items.map((item, i) => {
      const sku = item.item_sku.toUpperCase();
      const m = itemMap.get(sku)!;
      return [dnIds[i], sku, m.item_name, item.item_qty,
        user.username, user.username, now, now] as (string | number)[];
    }));

    // Total: 1 batchRead + 1 batchUpdate + 2 batchAppend = 4 API calls (any item count)

    return NextResponse.json({
      message: `${items.length} item berhasil disimpan`,
      results: items.map((item, i) => ({
        item_sku: item.item_sku.toUpperCase(),
        sales_id: salesIds[i],
        dn: dnIds[i],
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}