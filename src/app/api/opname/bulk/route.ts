// src/app/api/opname/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  batchReadSheets,
  batchAppendRows,
  getNextOpnameId,
} from "@/lib/sheets";
import { SessionUser } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser & { name: string };
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { popup_id, items } = body as {
      popup_id: string;
      items: { item_sku: string; item_qty_real: number }[];
    };

    if (!popup_id || !items || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 1 batch read: users, master_data, master_item, stock_opname
    const [usersRows, masterRows, itemRows, opnameRows] = await batchReadSheets([
      { sheetName: "users" },
      { sheetName: "master_data" },
      { sheetName: "master_item" },
      { sheetName: "stock_opname" },
    ]);

    // Resolve user_id
    const userRow = usersRows.find((u) => u.username === user.username);
    const opname_user_id = userRow?.user_id ?? user.username;

    // Generate opname_id from existing rows (no extra read)
    const existingIds = opnameRows
      .map((r) => r.opname_id)
      .filter((id) => typeof id === "string" && /^SO\d+$/.test(id))
      .map((id) => parseInt(id.slice(2), 10))
      .filter((n) => !isNaN(n));
    const nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    const opnameId = `SO${String(nextNum).padStart(4, "0")}`;

    // Build lookup maps
    const stockMap = new Map(
      masterRows.map((r) => [`${r.stock_popup_id}::${r.item_sku}`, r])
    );
    const itemMap = new Map(itemRows.map((i) => [i.item_sku, i]));

    // Validate & build rows
    const errors: { item_sku: string; error: string }[] = [];
    const rowsToAppend: (string | number)[][] = [];

    for (const entry of items) {
      const sku = entry.item_sku.toUpperCase();
      const item = itemMap.get(sku);
      if (!item) {
        errors.push({ item_sku: sku, error: "Item tidak ditemukan di master_item" });
        continue;
      }

      const stockEntry = stockMap.get(`${popup_id}::${sku}`);
      const cutoffQty = stockEntry ? Number(stockEntry.item_qty) : 0;

      rowsToAppend.push([
        opname_user_id,
        opnameId,
        popup_id,
        sku,
        item.item_name,
        entry.item_qty_real,
        cutoffQty,
        user.username,
        user.username,
        now,
        now,
      ]);
    }

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // 1 batch append — semua item sekaligus
    await batchAppendRows("stock_opname", rowsToAppend);

    return NextResponse.json({
      message: `${rowsToAppend.length} item opname berhasil disimpan`,
      opname_id: opnameId,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}