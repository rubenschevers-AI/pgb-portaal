import { createClient } from '@/lib/supabase/server';
import PlanningClient from '@/components/planning/PlanningClient';
import SectionTabs from '@/components/layout/SectionTabs';

export default async function PlanningPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: ownerIdData } = await supabase.rpc('my_owner_id');
  const ownerId = (ownerIdData as string) ?? user!.id;
  const isBeheerder = ownerId === user!.id;

  const TABS = isBeheerder
    ? [
        { href: '/planning',      label: 'Planning' },
        { href: '/basisrooster',  label: 'Basisrooster' },
        { href: '/open-diensten', label: 'Open diensten' },
      ]
    : [
        { href: '/planning',      label: 'Mijn diensten' },
        { href: '/open-diensten', label: 'Open diensten' },
      ];

  const van = new Date(); van.setDate(van.getDate() - 7);
  const tot = new Date(); tot.setDate(tot.getDate() + 21);

  // Zorgverlener: find own team_member_id
  let mijnTeamLidId: string | null = null;
  if (!isBeheerder) {
    const { data: mijnLid } = await supabase
      .from('team_members')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('member_user_id', user!.id)
      .single();
    mijnTeamLidId = mijnLid?.id ?? null;
  }

  const dienstenQuery = supabase
    .from('planning')
    .select('*, team_members(id, naam, rol)')
    .eq('owner_id', ownerId)
    .gte('datum', van.toISOString().split('T')[0])
    .lte('datum', tot.toISOString().split('T')[0])
    .order('datum').order('start_tijd');

  const [
    { data: diensten },
    { data: team },
    { data: basisrooster },
  ] = await Promise.all([
    // Zorgverlener sees only their own assigned shifts
    !isBeheerder && mijnTeamLidId
      ? dienstenQuery.eq('team_member_id', mijnTeamLidId)
      : !isBeheerder
        ? Promise.resolve({ data: [] })
        : dienstenQuery,
    supabase
      .from('team_members')
      .select('id, naam, rol')
      .eq('owner_id', ownerId)
      .eq('status', 'actief'),
    isBeheerder
      ? supabase
          .from('basisrooster')
          .select('id, dag_van_week, start_tijd, eind_tijd, team_member_id, notities')
          .eq('owner_id', ownerId)
          .order('dag_van_week').order('start_tijd')
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="flex flex-col h-full">
      <SectionTabs tabs={TABS} />
      <div className="flex-1 overflow-hidden flex flex-col">
        <PlanningClient
          diensten={diensten ?? []}
          team={team ?? []}
          userId={user!.id}
          ownerId={ownerId}
          basisrooster={basisrooster ?? []}
          isBeheerder={isBeheerder}
        />
      </div>
    </div>
  );
}
