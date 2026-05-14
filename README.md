# Bazaar ERP

Sistem manajemen stok dan penjualan popup bazaar berbasis Next.js + Google Sheets.

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** (Dark/Light mode)
- **TanStack Table** (tabel interaktif)
- **NextAuth** (autentikasi via Credentials)
- **Google Sheets API** (sebagai database)
- **Vercel** (deployment)

## Setup

### 1. Clone & Install

```bash
git clone <repo>
cd bazaar-erp
npm install
```

### 2. Google Sheets Setup

1. Buat Google Spreadsheet baru
2. Buat 7 sheet dengan nama persis:
   - `users` — kolom: `user_id, username, password, role`
   - `popup_list` — kolom: `id_location, popup_name, popup_location`
   - `master_item` — kolom: `item_sku, item_name, item_variant, item_category, item_hpj`
   - `master_data` — kolom: `stock_popup_id, item_sku, item_name, item_variant, item_qty, item_category, item_hpj, item_discount, created_by, update_by, created_at, update_at`
   - `sales_data` — kolom: `sales_user_id, sales_id, item_sku, item_name, item_variant, item_qty, delivery_note, created_by, update_by, created_at, update_at`
   - `delivery_note_sales` — kolom: `id_delivery_note, item_sku, item_name, item_qty, created_by, update_by, created_at, update_at`
   - `stock_opname` — kolom: `opname_user_id, opname_id, popup_id, item_sku, item_name, item_qty, item_cutoff_qty, created_by, update_by, created_at, update_at`

3. Tambah data awal di sheet `users`:
   ```
   USR-001 | admin | admin123 | admin
   USR-002 | staff1 | staff123 | staff
   ```
   > Password bisa plain text untuk setup awal, atau bcrypt hash.

### 3. Google Service Account

1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Buat project baru
3. Enable **Google Sheets API**
4. Buat **Service Account** → buat key (JSON)
5. **Share** spreadsheet ke email service account (Editor)
6. Salin `client_email` dan `private_key` dari JSON key

### 4. Environment Variables

Salin `.env.example` ke `.env.local` dan isi:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-dengan-openssl-rand-base64-32

GOOGLE_SHEETS_SPREADSHEET_ID=id-dari-url-spreadsheet
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
```

> Untuk `GOOGLE_PRIVATE_KEY`, pastikan newline ditulis sebagai `\n` dalam satu baris.

### 5. Jalankan

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

## Deployment ke Vercel

1. Push ke GitHub
2. Import di [vercel.com](https://vercel.com)
3. Tambahkan semua environment variables di Vercel dashboard
4. Deploy

---

## Fitur

| Fitur | Admin | Staff |
|-------|-------|-------|
| Lihat Stock | ✅ | ✅ |
| Tambah/Bulk Stock | ✅ | ❌ |
| Stock Opname (CRUD) | ✅ | ✅ |
| Sales (tambah) | ✅ | ✅ |
| Sales (hapus) | ✅ | ❌ |
| Popup List (CRUD) | ✅ | ❌ |

## Nomor Otomatis

- **Sales ID**: `SL0001`, `SL0002`, ...
- **Delivery Note**: `MP-DN-2026-0001`, reset tiap tahun
- **Stock Opname**: `SO0001`, `SO0002`, ...
