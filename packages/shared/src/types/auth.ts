export type Role = 'beheerder' | 'zorgverlener';

export interface Tenant {
  id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  tenant_id: string;
  full_name: string;
  role: Role;
  avatar_url?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface Invitation {
  id: string;
  tenant_id: string;
  invited_by: string;
  email?: string;
  token: string;
  role: 'zorgverlener';
  expires_at: string;
  accepted_at?: string;
  accepted_by?: string;
  created_at: string;
}
