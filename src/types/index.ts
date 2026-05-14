// src/types/index.ts

export type Role = "admin" | "staff";

export interface User {
  user_id: string;
  username: string;
  password: string;
  role: Role;
}

export interface PopupStore {
  id_location: string;
  popup_name: string;
  popup_location: string;
}

export interface MasterItem {
  item_sku: string;
  item_name: string;
  item_variant: string;
  item_category: string;
  item_hpj: number;
}

export interface MasterData {
  stock_popup_id: string;
  item_sku: string;
  item_name: string;
  item_variant: string;
  item_qty: number;
  item_category: string;
  item_hpj: number;
  item_discount: number;
  created_by: string;
  update_by: string;
  created_at: string;
  update_at: string;
}

export interface SalesData {
  sales_user_id: string;
  sales_id: string;
  item_sku: string;
  item_name: string;
  item_variant: string;
  item_qty: number;
  delivery_note: string;
  created_by: string;
  update_by: string;
  created_at: string;
  update_at: string;
}

export interface DeliveryNote {
  id_delivery_note: string;
  item_sku: string;
  item_name: string;
  item_qty: number;
  created_by: string;
  update_by: string;
  created_at: string;
  update_at: string;
}

export interface StockOpname {
  opname_user_id: string;
  opname_id: string;
  popup_id: string;
  item_sku: string;
  item_name: string;
  item_qty: number;
  item_cutoff_qty: number;
  created_by: string;
  update_by: string;
  created_at: string;
  update_at: string;
}

export interface SessionUser {
  id: string;
  username: string;
  role: Role;
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Form types
export interface AddStockForm {
  stock_popup_id: string;
  item_sku: string;
  item_qty: number;
}

export interface SalesForm {
  sales_user_id: string;
  item_sku: string;
  item_qty: number;
}

export interface OpnameForm {
  opname_user_id: string;
  popup_id: string;
  item_sku: string;
  item_qty_real: number;
}

export interface PopupForm {
  popup_name: string;
  popup_location: string;
}
