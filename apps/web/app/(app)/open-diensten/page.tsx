import { createClient } from '@/lib/supabase/server';
import OpenDienstenClient from '@/components/open-diensten/OpenDienstenClient';
import SectionTabs from '@/components/layout/SectionTabs';

export default async function OpenDienstenPage() {
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

  // Fetch open shifts
  const { data: openDiensten } = await supabase
    .from('planning')
    .select('id, datum, start_tijd, eind_tijd, notities, status, team_member_id')
    .eq('owner_id', ownerId)
    .eq('status', 'open')
    .gte('datum', new Date().toISOString().split('T')[0])
    .order('datum')
    .order('start_tijd');

  const dienstIds = (openDiensten ?? []).map(d => d.id);

  // Fetch aanmeldingen for these shifts
  const { data: aanmeldingen } = dienstIds.length > 0
    ? await supabase
        .from('dienst_aanmeldingen')
        .select('id, planning_id, team_member_id, status, gewijzigd_door_naam, created_at')
        .in('planning_id', dienstIds)
    : { data: [] };

  // Fetch team members
  const { data: team } = await supabase
    .from('team_members')
    .select('id, naam, rol, member_user_id')
    .eq('owner_id', ownerId)
    .eq('status', 'actief')
    .order('naam');

  // Find current user's team_member_id (if they are a team member)
  const mijnTeamLid = (team ?? []).find(t => t.member_user_id === user!.id);

  return (
    <div className="flex flex-col h-full">
      <SectionTabs tabs={TABS} />
      <OpenDienstenClient
        openDiensten={openDiensten ?? []}
        aanmeldingen={aanmeldingen ?? []}
        team={team ?? []}
        userId={user!.id}
        ownerId={ownerId}
        isBeheerder={isBeheerder}
        mijnTeamLidId={mijnTeamLid?.id ?? null}
      />
    </div>
  );
}
