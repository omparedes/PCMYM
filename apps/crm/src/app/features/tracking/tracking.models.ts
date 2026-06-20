// Shape of the jsonb returned by the public RPC get_public_tracking_info().
// Not derived from database.types.ts (the function returns a hand-built
// jsonb object, not a table row) — kept in sync with the RPC by hand.
// UI labels in Spanish live only in Angular (ADR 0006); statuses here reuse
// the same label maps as the authenticated side (service-orders/budgets).

export interface PublicTrackingBudget {
  folio: number;
  status: 'sent' | 'approved' | 'rejected';
  total_amount: number;
}

export interface PublicTrackingHistoryEntry {
  to_status: string;
  changed_at: string;
}

export interface PublicTrackingInfo {
  folio: number;
  status: string;
  equipment_type: string | null;
  brand: string | null;
  model: string | null;
  received_at: string;
  estimated_delivery: string | null;
  business_name: string | null;
  customer_name: string | null;
  budget: PublicTrackingBudget | null;
  history: PublicTrackingHistoryEntry[];
}
