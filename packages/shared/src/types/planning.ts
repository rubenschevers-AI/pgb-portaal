export type ShiftStatus = 'open' | 'assigned' | 'completed' | 'cancelled';
export type SwapStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface Schedule {
  id: string;
  tenant_id: string;
  name: string;
  day_of_week?: number; // 0=Sun..6=Sat
  start_time: string;   // HH:MM
  end_time: string;
  is_active: boolean;
  created_at: string;
}

export interface Shift {
  id: string;
  tenant_id: string;
  schedule_id?: string;
  assigned_to?: string;
  date: string;         // YYYY-MM-DD
  start_time: string;
  end_time: string;
  status: ShiftStatus;
  notes?: string;
  created_at: string;
}

export interface ShiftSwapRequest {
  id: string;
  tenant_id: string;
  shift_id: string;
  requested_by: string;
  requested_to?: string;
  status: SwapStatus;
  message?: string;
  resolved_at?: string;
  created_at: string;
}
