// src/app/api/popup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { readSheet, appendRow, updateRow, deleteRow } from "@/lib/sheets";
import { SessionUser } from "@/types";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const rows = await readSheet("popup_list");
    return NextResponse.json({ data: rows });
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
    const { popup_name, popup_location } = body;
    const id = `POP-${Date.now()}`;

    await appendRow("popup_list", [id, popup_name, popup_location]);
    return NextResponse.json({ message: "Popup created", id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser & { name: string };
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id_location, popup_name, popup_location } = body;

    const rows = await readSheet("popup_list");
    const idx = rows.findIndex((r) => r.id_location === id_location);
    if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await updateRow("popup_list", idx + 2, [id_location, popup_name, popup_location]);
    return NextResponse.json({ message: "Updated" });
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
    const id = searchParams.get("id");

    const rows = await readSheet("popup_list");
    const idx = rows.findIndex((r) => r.id_location === id);
    if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await deleteRow("popup_list", idx + 2);
    return NextResponse.json({ message: "Deleted" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
