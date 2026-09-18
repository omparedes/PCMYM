export interface PublicQueueItem {
  relative_order: number;
  equipment_category: 'Laptop' | 'PC' | 'Equipo';
  work_summary: string;
  phase: 'in_progress' | 'waiting';
  estimated_remaining_minutes: number | null;
  is_overdue: boolean;
}

export interface EstimatedWaitBand {
  min_minutes: number;
  max_minutes: number;
  label: string;
}

export interface PublicQueueResponse {
  is_enabled: boolean;
  business_name?: string;
  generated_at?: string;
  last_activity_at?: string | null;
  counts?: {
    in_service: number;
    waiting: number;
    external_or_paused: number;
    total_active_queue: number;
  };
  active_items?: PublicQueueItem[];
  waiting_items?: PublicQueueItem[];
  estimated_wait_band?: EstimatedWaitBand | null;
  error?: string;
}
