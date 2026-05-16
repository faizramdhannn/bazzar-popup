// src/lib/sheets.ts
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

export function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return auth;
}

export async function getSheetsClient() {
  const auth = getAuthClient();
  return google.sheets({ version: "v4", auth });
}

// ─── Generic read ─────────────────────────────────────────────────────────────
export async function readSheet(sheetName: string, range = "A:Z") {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${range}`,
  });
  const rows = res.data.values ?? [];
  if (rows.length < 1) return [];
  const [headers, ...data] = rows;
  return data.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h: string, i: number) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });
}

// ─── Batch read multiple sheets in 1 API call ─────────────────────────────────
export async function batchReadSheets(
  requests: { sheetName: string; range?: string }[]
): Promise<Record<string, string>[][]> {
  const sheets = await getSheetsClient();
  const ranges = requests.map((r) => `${r.sheetName}!${r.range ?? "A:Z"}`);

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges,
  });

  return (res.data.valueRanges ?? []).map((vr) => {
    const rows = vr.values ?? [];
    if (rows.length < 1) return [];
    const [headers, ...data] = rows;
    return data.map((row) => {
      const obj: Record<string, string> = {};
      (headers as string[]).forEach((h, i) => {
        obj[h] = (row[i] as string) ?? "";
      });
      return obj;
    });
  });
}

// ─── Generic append (single row) ─────────────────────────────────────────────
export async function appendRow(sheetName: string, values: (string | number)[]) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

// ─── Batch append multiple rows to ONE sheet in 1 API call ───────────────────
export async function batchAppendRows(
  sheetName: string,
  rows: (string | number)[][]
) {
  if (rows.length === 0) return;
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
}

// ─── Update a specific row ────────────────────────────────────────────────────
export async function updateRow(
  sheetName: string,
  rowIndex: number, // 1-based sheet row (including header)
  values: (string | number)[]
) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

// ─── Batch update multiple rows (different row indices) in 1 API call ────────
export async function batchUpdateRows(
  sheetName: string,
  updates: { rowIndex: number; values: (string | number)[] }[]
) {
  if (updates.length === 0) return;
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: updates.map(({ rowIndex, values }) => ({
        range: `${sheetName}!A${rowIndex}`,
        values: [values],
      })),
    },
  });
}

// ─── Delete a row ─────────────────────────────────────────────────────────────
export async function deleteRow(sheetName: string, rowIndex: number) {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );
  if (!sheet?.properties?.sheetId) throw new Error("Sheet not found");

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: "ROWS",
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  });
}

// ─── Auto-number helpers ──────────────────────────────────────────────────────
export async function getNextOpnameId(): Promise<string> {
  const rows = await readSheet("stock_opname");
  const ids = rows
    .map((r) => r.opname_id)
    .filter((id) => /^SO\d+$/.test(id))
    .map((id) => parseInt(id.replace("SO", ""), 10));
  const next = ids.length > 0 ? Math.max(...ids) + 1 : 1;
  return `SO${String(next).padStart(4, "0")}`;
}

export async function getNextDeliveryNoteId(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await readSheet("delivery_note_sales");
  const prefix = `MP-DN-${year}-`;
  const ids = rows
    .map((r) => r.id_delivery_note)
    .filter((id) => id?.startsWith(prefix))
    .map((id) => parseInt(id.replace(prefix, ""), 10));
  const next = ids.length > 0 ? Math.max(...ids) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export async function getNextSalesId(): Promise<string> {
  const rows = await readSheet("sales_data");
  const ids = rows
    .map((r) => r.sales_id)
    .filter((id) => /^SL\d+$/.test(id))
    .map((id) => parseInt(id.replace("SL", ""), 10));
  const next = ids.length > 0 ? Math.max(...ids) + 1 : 1;
  return `SL${String(next).padStart(4, "0")}`;
}

// ─── Generate a sequence of IDs from existing rows (no extra read) ────────────
export function generateSalesIds(existingRows: Record<string, string>[], count: number): string[] {
  const ids = existingRows
    .map((r) => r.sales_id)
    .filter((id) => /^SL\d+$/.test(id))
    .map((id) => parseInt(id.replace("SL", ""), 10));
  const next = ids.length > 0 ? Math.max(...ids) + 1 : 1;
  return Array.from({ length: count }, (_, i) => `SL${String(next + i).padStart(4, "0")}`);
}

export function generateDeliveryNoteIds(existingRows: Record<string, string>[], count: number): string[] {
  const year = new Date().getFullYear();
  const prefix = `MP-DN-${year}-`;
  const ids = existingRows
    .map((r) => r.id_delivery_note)
    .filter((id) => id?.startsWith(prefix))
    .map((id) => parseInt(id.replace(prefix, ""), 10));
  const next = ids.length > 0 ? Math.max(...ids) + 1 : 1;
  return Array.from({ length: count }, (_, i) => `${prefix}${String(next + i).padStart(4, "0")}`);
}

export function nowIso() {
  return new Date().toISOString();
}