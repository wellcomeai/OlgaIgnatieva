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
  last_update_at: string | null;
  created_at: string;
  subscribers_count: number;
}

export interface BotUpdate {
  welcome_text?: string;
  welcome_buttons?: WelcomeButton[];
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
