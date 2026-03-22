export type TaskCategory =
  | 'persoonlijke_verzorging'
  | 'huishouden'
  | 'medicatie'
  | 'mobiliteit'
  | 'algemeen';

export type Mood = 'goed' | 'matig' | 'zorgelijk';

export interface Task {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  is_recurring: boolean;
  recurrence_days?: number[]; // 0=Sun..6=Sat
  created_by: string;
  is_active: boolean;
  created_at: string;
}

export interface TaskLog {
  id: string;
  tenant_id: string;
  task_id: string;
  shift_id?: string;
  assigned_to?: string;
  date: string;
  is_completed: boolean;
  completed_at?: string;
  completed_by?: string;
  notes?: string;
  created_at: string;
}

export interface DailyReport {
  id: string;
  tenant_id: string;
  shift_id?: string;
  author_id: string;
  date: string;
  body: string;
  mood?: Mood;
  is_signed: boolean;
  signed_at?: string;
  created_at: string;
  updated_at: string;
}
