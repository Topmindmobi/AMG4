export type UserRole = "customer" | "admin" | "supplier" | "rider";

export type OrderStatus =
  | "pending"
  | "awaiting_supplier"
  | "supplier_confirmed"
  | "confirmed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

/** Rider-facing delivery pipeline (kanban), separate from AMG order status. */
export type RiderDeliveryStatus =
  | "assigned"
  | "collected"
  | "in_transit"
  | "delivered"
  | "paid"
  | "failed";

/** One recorded step in the rider last-mile pipeline. */
export interface RiderDeliveryEvent {
  status: RiderDeliveryStatus;
  at: string;
  note?: string | null;
}

/** Supplier → AMG inbound pipeline (AMG alone certifies fulfilled). */
export type SupplyRequestStatus =
  | "pending"
  | "confirmed"
  | "dispatched"
  | "fulfilled"
  | "rejected";

export type PaymentMethod = "cod" | "mpesa";

export type DeliveryMethod = "doorstep" | "dropoff";

/** How the supplier will deliver stock into an AMG hub. */
export type SupplyMethod = "boda" | "van" | "self_dropoff" | "courier";

export type Town =
  | "Nairobi"
  | "Mombasa"
  | "Kisumu"
  | "Homabay"
  | "Mbita"
  | "Migori";

/** Logistics plan filled when the supplier confirms they will supply. */
export interface SupplyLogisticsPlan {
  method: SupplyMethod;
  amg_location_id: string;
  amg_location_name: string;
  amg_location_town: Town;
  planned_dispatch_at: string;
  notes: string | null;
}

/** Vehicle used when supplier dispatches stock to AMG. */
export type SupplyVehicleType = "boda" | "van" | "truck";

/** Vehicle a rider uses for AMG → customer last-mile delivery. */
export type RiderVehicleType = "boda" | "van" | "truck";

/** Driver + vehicle details captured at dispatch time. */
export interface SupplyDispatchDetails {
  vehicle_type: SupplyVehicleType;
  driver_name: string;
  driver_phone: string;
  vehicle_plate: string;
  vehicle_description: string | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  town: Town | null;
  /** Linked supplier org when role is supplier */
  supplier_id: string | null;
  /** Linked rider record when role is rider */
  rider_id: string | null;
  created_at: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  maps_url?: string | null;
  /** Set once we've redirected this user to complete their profile — never redirect again after this. */
  profile_prompt_shown_at?: string | null;
}

export interface Rider {
  id: string;
  name: string;
  phone: string | null;
  town: Town | null;
  vehicle: RiderVehicleType;
  active: boolean;
  created_at: string;
  lat?: number | null;
  lng?: number | null;
  maps_url?: string | null;
}

export interface DropoffPoint {
  id: string;
  town: Town;
  name: string;
  description: string | null;
}

export type RoleApplicationType = "supplier" | "rider";
export type RoleApplicationStatus = "pending" | "approved" | "rejected";

export interface RoleApplication {
  id: string;
  user_id: string;
  type: RoleApplicationType;
  status: RoleApplicationStatus;
  business_name: string | null;
  vehicle: string | null;
  email: string;
  contact_phone: string;
  town: Town;
  notes: string | null;
  national_id_path: string | null;
  business_permit_path: string | null;
  driving_license_path: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
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

/** Warehouse / shop / pickup site a supplier can ship from. */
export type SupplierAddressLabel = "warehouse" | "shop" | "pickup" | "other";

/**
 * Supplier origin address — manual fields + optional Google Maps pin.
 * Used for distance / inbound transport cost when ranking suppliers.
 */
export interface SupplierAddress {
  id: string;
  supplier_id: string;
  label: SupplierAddressLabel;
  /** Short name e.g. "Main warehouse" */
  name: string;
  town: Town;
  /** Street, landmark, building */
  line1: string;
  phone: string | null;
  /** Paste from Google Maps share / directions */
  maps_url: string | null;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
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
  /** Optional — enables email status updates alongside SMS/in-app notifications. */
  email?: string | null;
  town: Town;
  address: string;
  payment_method: PaymentMethod;
  mpesa_phone: string | null;
  /** True once payment has actually been received upfront (online M-Pesa pay-now). */
  paid: boolean;
  paid_at?: string | null;
  /** Pre-discount line total. total_kes is what the buyer actually owes/paid. */
  subtotal_kes: number;
  /** Automatic reward for paying online upfront (see PAY_NOW_DISCOUNT_RATE). */
  discount_kes: number;
  delivery_method: DeliveryMethod;
  dropoff_point_id?: string | null;
  dropoff_point_name?: string | null;
  rider_id?: string | null;
  rider_name_snapshot?: string | null;
  /** Rider's vehicle at the moment of dispatch (rider's vehicle may change later). */
  rider_vehicle_snapshot?: RiderVehicleType | null;
  /** Rider kanban stage once the order is assigned for last-mile delivery. */
  rider_delivery_status?: RiderDeliveryStatus | null;
  /** Optional note when rider marks Fail Delivery. */
  rider_fail_reason?: string | null;
  /** Append-only log of rider stages (visible to customer + admin). */
  rider_delivery_events?: RiderDeliveryEvent[] | null;
  delivered_at?: string | null;
  /** Set the moment status becomes 'delivered' — admin pipeline hygiene only, doesn't affect the buyer's own view. */
  archived_at?: string | null;
  /** How many "leave a review" nudges have gone out (capped at 2, every 3 days). */
  review_reminder_count?: number;
  review_reminder_last_sent_at?: string | null;
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
  /** Plan for delivering stock to AMG (set on confirm). */
  logistics: SupplyLogisticsPlan | null;
  /** Driver / vehicle details (set when marked dispatched). */
  dispatch: SupplyDispatchDetails | null;
  dispatched_at: string | null;
  fulfilled_at: string | null;
  /** Admin profile id who certified inbound inspection. */
  fulfilled_by: string | null;
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

export type RiderPayoutStatus = "sent" | "failed";

/** Per-delivery commission paid out to the rider once they mark an order delivered. */
export interface RiderPayout {
  id: string;
  order_id: string;
  rider_id: string;
  rider_name: string;
  amount_kes: number;
  status: RiderPayoutStatus;
  created_at: string;
}

export type QuoteRequestStatus = "quoted" | "converted";

export interface QuoteRequestItem {
  /** Free-text line as the buyer typed it, e.g. "iron sheets" */
  description: string;
  qty: number;
  unit: string;
  /** Best-match catalog product, when the instant-quote engine found one */
  matched_product_id: string | null;
  matched_name: string | null;
  unit_price_kes: number | null;
  line_total_kes: number | null;
  matched: boolean;
}

/** Competing supplier offer discovered during quote market analysis. */
export interface QuoteLineMarketOffer {
  supplier_id: string;
  supplier_name: string;
  product_name: string;
  unit_price_kes: number;
  line_total_kes: number;
  transport_kes: number;
  landed_line_kes: number;
  distance_km: number;
}

/** Per-line verdict: is the quoted price still the best available? */
export interface QuoteLineAlert {
  description: string;
  matched_name: string | null;
  quoted_unit_price_kes: number | null;
  quoted_line_total_kes: number;
  best_offer: QuoteLineMarketOffer | null;
  savings_kes: number;
  savings_pct: number;
  /** True when another supplier beats the current quote. */
  is_alert: boolean;
  message: string;
}

/** AI / heuristic market check attached to a quote request. */
export interface QuoteMarketAnalysis {
  analyzed_at: string;
  source: "heuristic" | "openai";
  summary: string;
  has_better_prices: boolean;
  potential_savings_kes: number;
  line_alerts: QuoteLineAlert[];
}

export interface QuoteRequest {
  id: string;
  user_id: string | null;
  customer_name: string;
  phone: string;
  town: Town;
  items: QuoteRequestItem[];
  subtotal_kes: number;
  delivery_estimate_kes: number;
  total_kes: number;
  unmatched_count: number;
  status: QuoteRequestStatus;
  created_at: string;
  converted_order_id?: string | null;
  /** Filled when AMG runs market / AI analysis against supplier prices. */
  market_analysis?: QuoteMarketAnalysis | null;
}

export type CallbackRequestStatus = "pending" | "contacted" | "resolved";

/** "Order on call" — a customer left their number instead of checking out online. */
export interface CallbackRequest {
  id: string;
  user_id: string | null;
  customer_name: string;
  phone: string;
  note: string | null;
  status: CallbackRequestStatus;
  created_at: string;
  contacted_at: string | null;
  contacted_by: string | null;
}

export interface PushSubscriptionRecord {
  user_id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  created_at: string;
}

/** What AMG is rating on an order. */
export type RatingSubject =
  | "delivery"
  | "supplier_response"
  | "supplier_delivery"
  | "goods"
  | "rider";

/** Score dimensions shared across rating subjects. */
export type RatingDimension =
  | "speed"
  | "turnaround"
  | "quality_of_service"
  | "quality_of_goods";

export type RatingScores = Record<RatingDimension, number>;

/** Admin (or system) quality rating tied to an order. Scores are 1–5. */
export interface ServiceRating {
  id: string;
  order_id: string;
  subject: RatingSubject;
  supplier_id: string | null;
  supplier_name: string | null;
  rider_id: string | null;
  rider_name: string | null;
  scores: RatingScores;
  /** Mean of the four dimensions */
  average: number;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

/**
 * Buyer's own review of a delivered order — overall experience + delivery,
 * one row per order. Distinct from ServiceRating above (that's AMG's
 * internal admin-only rating of supplier/rider quality).
 */
export interface OrderRating {
  id: string;
  order_id: string;
  user_id: string;
  overall_rating: number;
  delivery_rating: number;
  review_text: string | null;
  created_at: string;
  updated_at: string;
}

/** Buyer's rating of one product/line item within a delivered order. */
export interface ProductRating {
  id: string;
  order_id: string;
  order_item_id: string;
  product_id: string | null;
  user_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  updated_at: string;
}

export type ReturnRequestStatus = "requested" | "approved" | "rejected" | "refunded";

export type ReturnReason =
  | "damaged"
  | "wrong_item"
  | "not_as_described"
  | "changed_mind"
  | "other";

export interface ReturnRequestItem {
  id: string;
  return_request_id: string;
  order_item_id: string;
  qty: number;
}

export interface ReturnRequest {
  id: string;
  order_id: string;
  user_id: string;
  status: ReturnRequestStatus;
  reason: ReturnReason;
  reason_notes: string | null;
  requested_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  refund_amount_kes: number | null;
  admin_notes: string | null;
  items?: ReturnRequestItem[];
}
