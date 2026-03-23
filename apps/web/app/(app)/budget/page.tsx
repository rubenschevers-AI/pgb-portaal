import { createClient } from '@/lib/supabase/server';
import BudgetClient from '@/components/budget/BudgetClient';
import SectionTabs from '@/components/layout/SectionTabs';
import { redirect } from 'next/navigation';

const TABS = [
  { href: '/uren', label: 'Uren' },
  { href: '/budget', label: 'Budget' },
];

export default async function BudgetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: ownerIdData } = await supabase.rpc('my_owner_id');
  const ownerId = (ownerIdData as string) ?? user!.id;
  if (ownerId !== user!.id) redirect('/uren');
  const userId = user!.id;

  const [
    { data: budget },
    { data: teamleden },
    { data: recentUren },
  ] = await Promise.all([
    supabase
      .from('budget')
      .select('*')
      .eq('owner_id', userId)
      .order('periode_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('team_members')
      .select('id, naam, rol, uurtarief, status')
      .eq('owner_id', userId)
      .eq('status', 'actief')
      .order('naam'),
    supabase
      .from('uren_registratie')
      .select('id, datum, start_tijd, eind_tijd, pauze_minuten, team_member_id, team_members(naam, uurtarief)')
      .eq('owner_id', userId)
      .eq('status', 'goedgekeurd')
      .order('datum', { ascending: false })
      .limit(10),
  ]);

  const { data: alleUren } = await supabase
    .from('uren_registratie')
    .select('start_tijd, eind_tijd, pauze_minuten, team_member_id, team_members(uurtarief)')
    .eq('owner_id', userId)
    .eq('status', 'goedgekeurd');

  const totaalVerbruikt = (alleUren ?? []).reduce((sum, entry) => {
    const start = new Date(`1970-01-01T${entry.start_tijd}`);
    const eind = new Date(`1970-01-01T${entry.eind_tijd}`);
    const minuten = (eind.getTime() - start.getTime()) / 60000 - (entry.pauze_minuten ?? 0);
    const uren = Math.max(0, minuten / 60);
    const tarief = (entry.team_members as { uurtarief: number } | null)?.uurtarief ?? 0;
    return sum + uren * tarief;
  }, 0);

  return (
    <div className="flex flex-col h-full">
      <SectionTabs tabs={TABS} />
      <BudgetClient
        budget={budget}
        teamleden={teamleden ?? []}
        recentUren={recentUren ?? []}
        totaalVerbruikt={totaalVerbruikt}
        userId={userId}
      />
    </div>
  );
}
