import { createClient } from '@/lib/supabase/server';
import TeamClient from '@/components/team/TeamClient';
import SectionTabs from '@/components/layout/SectionTabs';
import { redirect } from 'next/navigation';

const TABS = [
  { href: '/team', label: 'Team' },
  { href: '/client', label: 'Cliënt' },
];

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: ownerIdData } = await supabase.rpc('my_owner_id');
  const ownerId = (ownerIdData as string) ?? user!.id;
  if (ownerId !== user!.id) redirect('/client');

  const { data: leden } = await supabase
    .from('team_members')
    .select('*')
    .eq('owner_id', user!.id)
    .order('naam');

  return (
    <div className="flex flex-col h-full">
      <SectionTabs tabs={TABS} />
      <TeamClient leden={leden ?? []} userId={user!.id} />
    </div>
  );
}
