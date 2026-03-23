import { createClient } from '@/lib/supabase/server';
import UrenClient from '@/components/uren/UrenClient';
import SectionTabs from '@/components/layout/SectionTabs';

export default async function UrenPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: ownerIdData } = await supabase.rpc('my_owner_id');
  const ownerId = (ownerIdData as string) ?? userId;
  const isBeheerder = ownerId === userId;

  const TABS = isBeheerder
    ? [{ href: '/uren', label: 'Uren' }, { href: '/budget', label: 'Budget' }]
    : [{ href: '/uren', label: 'Mijn uren' }];

  // Zorgverlener: find own team_member_id
  let mijnTeamLidId: string | null = null;
  if (!isBeheerder) {
    const { data: mijnLid } = await supabase
      .from('team_members')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('member_user_id', userId)
      .single();
    mijnTeamLidId = mijnLid?.id ?? null;
  }

  const teamPromise = isBeheerder
    ? supabase
        .from('team_members')
        .select('id, naam, rol, uurtarief')
        .eq('owner_id', ownerId)
        .eq('status', 'actief')
        .order('naam')
    : Promise.resolve({ data: [] as { id: string; naam: string; rol: string; uurtarief: number | null }[], error: null });

  const urenBase = supabase
    .from('uren_registratie')
    .select('id, datum, start_tijd, eind_tijd, pauze_minuten, omschrijving, status, team_member_id, team_members(naam, rol)')
    .eq('owner_id', ownerId)
    .order('datum', { ascending: false })
    .order('start_tijd', { ascending: false })
    .limit(100);

  const urenPromise = (!isBeheerder && !mijnTeamLidId)
    ? Promise.resolve({ data: [] })
    : (!isBeheerder && mijnTeamLidId)
      ? urenBase.eq('team_member_id', mijnTeamLidId)
      : urenBase;

  const [{ data: team }, { data: uren }] = await Promise.all([teamPromise, urenPromise]);

  return (
    <div className="flex flex-col h-full">
      <SectionTabs tabs={TABS} />
      <UrenClient
        uren={uren ?? []}
        team={team ?? []}
        userId={userId}
        ownerId={ownerId}
        isBeheerder={isBeheerder}
        mijnTeamLidId={mijnTeamLidId}
      />
    </div>
  );
}
