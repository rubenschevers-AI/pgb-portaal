import { createClient } from '@/lib/supabase/server';
import PlanningClient from '@/components/planning/PlanningClient';
import SectionTabs from '@/components/layout/SectionTabs';

const TABS = [
  { href: '/planning', label: 'Planning' },
  { href: '/basisrooster', label: 'Basisrooster' },
  { href: '/open-diensten', label: 'Open diensten' },
];

export default async function PlanningPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const van = new Date(); van.setDate(van.getDate() - 7);
  const tot = new Date(); tot.setDate(tot.getDate() + 21);

  const [
    { data: diensten },
    { data: team },
    { data: basisrooster },
  ] = await Promise.all([
    supabase
      .from('planning')
      .select('*, team_members(id, naam, rol)')
      .eq('owner_id', user!.id)
      .gte('datum', van.toISOString().split('T')[0])
      .lte('datum', tot.toISOString().split('T')[0])
      .order('datum').order('start_tijd'),
    supabase
      .from('team_members')
      .select('id, naam, rol')
      .eq('owner_id', user!.id)
      .eq('status', 'actief'),
    supabase
      .from('basisrooster')
      .select('id, dag_van_week, start_tijd, eind_tijd, team_member_id, notities')
      .eq('owner_id', user!.id)
      .order('dag_van_week').order('start_tijd'),
  ]);

  return (
    <div className="flex flex-col h-full">
      <SectionTabs tabs={TABS} />
      <div className="flex-1 overflow-hidden flex flex-col">
        <PlanningClient
          diensten={diensten ?? []}
          team={team ?? []}
          userId={user!.id}
          basisrooster={basisrooster ?? []}
        />
      </div>
    </div>
  );
}
