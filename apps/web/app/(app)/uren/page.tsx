import { createClient } from '@/lib/supabase/server';
import UrenClient from '@/components/uren/UrenClient';
import SectionTabs from '@/components/layout/SectionTabs';

const TABS = [
  { href: '/uren', label: 'Uren' },
  { href: '/budget', label: 'Budget' },
];

export default async function UrenPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user!.id;

  const [
    { data: team },
    { data: uren },
  ] = await Promise.all([
    supabase
      .from('team_members')
      .select('id, naam, rol, uurtarief')
      .eq('owner_id', userId)
      .eq('status', 'actief')
      .order('naam'),
    supabase
      .from('uren_registratie')
      .select('id, datum, start_tijd, eind_tijd, pauze_minuten, omschrijving, status, team_member_id, team_members(naam, rol)')
      .eq('owner_id', userId)
      .order('datum', { ascending: false })
      .order('start_tijd', { ascending: false })
      .limit(100),
  ]);

  return (
    <div className="flex flex-col h-full">
      <SectionTabs tabs={TABS} />
      <UrenClient
        uren={uren ?? []}
        team={team ?? []}
        userId={userId}
      />
    </div>
  );
}
