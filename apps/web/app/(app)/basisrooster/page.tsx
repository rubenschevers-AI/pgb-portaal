import { createClient } from '@/lib/supabase/server';
import BasisroosterClient from '@/components/basisrooster/BasisroosterClient';
import SectionTabs from '@/components/layout/SectionTabs';
import { redirect } from 'next/navigation';

const TABS = [
  { href: '/planning', label: 'Planning' },
  { href: '/basisrooster', label: 'Basisrooster' },
  { href: '/open-diensten', label: 'Open diensten' },
];

export default async function BasisroosterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: ownerIdData } = await supabase.rpc('my_owner_id');
  const ownerId = (ownerIdData as string) ?? user!.id;
  if (ownerId !== user!.id) redirect('/open-diensten');

  const [
    { data: roosterSlots },
    { data: team },
    { data: beschikbaarheid },
    { data: afwijkingen },
  ] = await Promise.all([
    supabase
      .from('basisrooster')
      .select('*, team_members(id, naam, rol)')
      .eq('owner_id', user!.id)
      .order('dag_van_week')
      .order('start_tijd'),
    supabase
      .from('team_members')
      .select('id, naam, rol, uurtarief, status')
      .eq('owner_id', user!.id)
      .eq('status', 'actief')
      .order('naam'),
    supabase
      .from('team_beschikbaarheid')
      .select('*')
      .eq('owner_id', user!.id)
      .order('dag_van_week')
      .order('start_tijd'),
    supabase
      .from('team_beschikbaarheid_afwijking')
      .select('*')
      .eq('owner_id', user!.id)
      .gte('datum', new Date().toISOString().split('T')[0])
      .order('datum'),
  ]);

  return (
    <div className="flex flex-col h-full">
      <SectionTabs tabs={TABS} />
      <div className="flex-1 overflow-hidden flex flex-col">
        <BasisroosterClient
          userId={user!.id}
          roosterSlots={roosterSlots ?? []}
          team={team ?? []}
          beschikbaarheid={beschikbaarheid ?? []}
          afwijkingen={afwijkingen ?? []}
        />
      </div>
    </div>
  );
}
