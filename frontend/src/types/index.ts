export type UUID = string;

export type UserRole = "admin" | "user";

export interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface User {
  id: UUID;
  email: string;
  role: UserRole;
  is_active: boolean;
  is_email_verified: boolean;
  trial_ends_at: string | null;
  created_at: string;
  profile?: UserProfile | null;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
  pending_verification?: boolean;
  dev_code?: string | null;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "cancelled"
  | "expired"
  | "past_due";

export interface Plan {
  id: UUID;
  name: string;
  price: string;
  currency: string;
  interval: "month" | "year";
  features: string[];
  sort_order: number;
}

export interface Subscription {
  id: UUID;
  plan_id: UUID | null;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancelled_at: string | null;
}

export interface Payment {
  id: UUID;
  amount: string;
  currency: string;
  status: "pending" | "success" | "failed" | "refunded";
  provider: "robokassa" | "stripe";
  created_at: string;
}

export interface ReferralStats {
  total_referred: number;
  converted: number;
  total_earned: string;
  pending_payout: string;
}

export interface MyReferralCode {
  code: string;
  url: string;
  stats: ReferralStats;
}

export interface ReferralPayout {
  id: UUID;
  amount: string;
  status: "pending" | "approved" | "paid" | "rejected";
  paid_at: string | null;
  created_at: string;
}

export interface ApiKey {
  id: UUID;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit: number;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ApiKeyCreated extends ApiKey {
  full_key: string;
}

export interface AdminStats {
  total_users: number;
  active_subscriptions: number;
  mrr: string;
  pending_payouts: string;
}

export interface ReferralUser {
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: "registered" | "trial" | "converted";
  created_at: string;
}

// ---- Telegram-боты ----

export type WebhookStatus = "pending" | "ok" | "error" | "no_https" | "disabled";

export interface WelcomeButton {
  text: string;
  url: string;
}

export interface Bot {
  id: UUID;
  tg_bot_id: number;
  username: string;
  first_name: string;
  is_active: boolean;
  webhook_status: WebhookStatus;
  webhook_error: string | null;
  welcome_text: string;
  welcome_buttons: WelcomeButton[];
  welcome_product_ids: UUID[];
  last_update_at: string | null;
  created_at: string;
  subscribers_count: number;
}

export interface BotUpdate {
  welcome_text?: string;
  welcome_buttons?: WelcomeButton[];
  welcome_product_ids?: UUID[];
  is_active?: boolean;
}

export interface BotWebhookInfo {
  url_set: boolean;
  pending_update_count: number;
  last_error_message: string | null;
  last_error_date: string | null;
}

export interface BotSubscriber {
  id: UUID;
  tg_user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: string | null;
  source: string | null;
  is_blocked: boolean;
  created_at: string;
  last_seen_at: string;
}

export interface BotSubscriberPage {
  items: BotSubscriber[];
  total: number;
}

export interface BotSourceStat {
  source: string | null;
  count: number;
}

// ---- Продукты и заказы ----

export interface ProductFile {
  id: UUID;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
}

export interface Product {
  id: UUID;
  title: string;
  description: string;
  price: string;
  delivery_message: string;
  protect_content: boolean;
  is_active: boolean;
  created_at: string;
  files_count: number;
  sales_count: number;
  revenue: string;
}

export interface ProductDetail extends Product {
  files: ProductFile[];
  buy_links: string[];
}

export interface ProductUpdate {
  title?: string;
  price?: string;
  description?: string;
  delivery_message?: string;
  protect_content?: boolean;
  is_active?: boolean;
}

export type OrderStatus = "pending" | "paid";

export interface Order {
  id: UUID;
  inv_id: number;
  product_id: UUID | null;
  product_title: string;
  amount: string;
  status: OrderStatus;
  paid_at: string | null;
  delivered_at: string | null;
  delivery_error: string | null;
  created_at: string;
  bot_username: string | null;
  subscriber_name: string | null;
  subscriber_username: string | null;
}

export interface OrderPage {
  items: Order[];
  total: number;
}

export interface OrderStats {
  revenue: string;
  paid_count: number;
  revenue_30d: string;
  paid_count_30d: number;
}

export interface PaymentsConfig {
  robokassa_configured: boolean;
  test_mode: boolean;
  receipt_enabled: boolean;
  result_url: string;
  success_url: string;
  fail_url: string;
}

// ---- Воронки ----

export type FlowNodeType =
  | "trigger"
  | "message"
  | "delay"
  | "question"
  | "offer"
  | "files"
  | "condition"
  | "tag";

export type TriggerKind = "start" | "start_label" | "keyword" | "purchase";

export interface FlowButton {
  id: string;
  type: "next" | "url";
  text: string;
  url?: string;
}

/** Настройки блока (все поля необязательны — набор зависит от типа). */
export interface FlowNodeData {
  title?: string;
  kind?: string;
  value?: string;
  text?: string;
  buttons?: FlowButton[];
  amount?: number;
  unit?: "minutes" | "hours" | "days";
  var?: string;
  validate?: "any" | "email" | "phone";
  product_id?: string | null;
  tag?: string;
  action?: "add" | "remove";
  [key: string]: unknown;
}

export interface FlowGraphNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  data: FlowNodeData;
}

export interface FlowGraphEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
}

export interface FlowGraph {
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
}

export interface FlowSummary {
  id: UUID;
  bot_id: UUID;
  name: string;
  is_active: boolean;
  trigger_kind: TriggerKind;
  trigger_value: string;
  created_at: string;
  updated_at: string;
  entered: number;
  in_progress: number;
}

export interface FlowDetail extends FlowSummary {
  graph: FlowGraph;
  node_stats: Record<string, number>;
  problems: string[];
}

export type FlowTemplate = "blank" | "welcome_sale" | "lead_magnet";

// ---- Настройки интеграций ----

export interface IntegrationField {
  key: string;
  label: string;
  type: "str" | "bool" | "choice";
  secret: boolean;
  help: string;
  choices: { value: string; label: string }[];
  source: "ui" | "env" | "none";
  value: string | boolean | null;
  is_set?: boolean;
}

export interface IntegrationsState {
  robokassa: IntegrationField[];
  urls: PaymentsConfig;
}
