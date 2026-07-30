export type UserRole = "customer" | "admin" | "supplier";

export type OrderStatus =
  | "pending"
  | "awaiting_supplier"
  | "supplier_confirmed"
  | "confirmed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type SupplyRequestStatus = "pending" | "confirmed" | "rejected";

export type PaymentMethod = "cod" | "mpesa";

export type Town = "Homabay" | "Mbita" | "Migori";

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  town: Town | null;
  /** Linked supplier org when role is supplier */
  supplier_id: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  description?: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  contact_phone: string | null;
  town: Town | null;
  notes: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  supplier_id: string | null;
  name: string;
  slug: string;
  short_description: string;
  detailed_description: string;
  description?: string;
  price_kes: number;
  stock: number;
  image_path: string | null;
  gallery: string[];
  barcode: string | null;
  towns: Town[];
  is_active: boolean;
  created_at: string;
  category?: Category;
  supplier?: Supplier | null;
}

export interface Order {
  id: string;
  user_id: string | null;
  customer_name: string;
  phone: string;
  town: Town;
  address: string;
  payment_method: PaymentMethod;
  mpesa_phone: string | null;
  status: OrderStatus;
  total_kes: number;
  created_at: string;
  buyer_notified_at?: string | null;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name_snapshot: string;
  price_kes: number;
  qty: number;
  supplier_id: string | null;
  supplier_name_snapshot: string | null;
}

export interface SupplyRequestItem {
  order_item_id: string;
  product_id: string | null;
  name: string;
  qty: number;
  price_kes: number;
}

export interface SupplyRequest {
  id: string;
  order_id: string;
  supplier_id: string;
  supplier_name: string;
  status: SupplyRequestStatus;
  items: SupplyRequestItem[];
  total_kes: number;
  customer_town: Town;
  /** Delivery note for AMG client (no public supplier branding) */
  delivery_note: string;
  created_at: string;
  confirmed_at: string | null;
}

export interface AppNotification {
  id: string;
  /** Profile id of recipient */
  user_id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
  order_id?: string | null;
  supply_request_id?: string | null;
}

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  price_kes: number;
  qty: number;
  image_path: string | null;
}

/** Group order lines by supplier for admin actions */
export interface SupplierOrderGroup {
  supplier_id: string | null;
  supplier_name: string;
  items: OrderItem[];
  total_kes: number;
  supply_request?: SupplyRequest | null;
}
