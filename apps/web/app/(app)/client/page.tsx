import { createClient } from '@/lib/supabase/server';
import ClientProfielClient from '@/components/client/ClientProfielClient';
import SectionTabs from '@/components/layout/SectionTabs';

const TABS = [
  { href: '/team', label: 'Team' },
  { href: '/client', label: 'Cliënt' },
];

export default async function ClientPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profiel } = await supabase
    .from('client_profiel')
    .select('*')
    .eq('owner_id', user!.id)
    .maybeSingle();

  // Check if current user is the owner (budgethouder) or a team member
  const { data: ownerIdData } = await supabase.rpc('my_owner_id');
  const ownerId = (ownerIdData as string) ?? user!.id;
  const isBeheerder = ownerId === user!.id;

  // If team member, fetch via owner's profile
  const { data: profielVoorTeam } = !isBeheerder && !profiel
    ? await supabase
        .from('client_profiel')
        .select('*')
        .eq('owner_id', ownerId)
        .maybeSingle()
    : { data: null };

  return (
    <div className="flex flex-col h-full">
      <SectionTabs tabs={TABS} />
      <ClientProfielClient
        profiel={profiel ?? profielVoorTeam ?? null}
        userId={user!.id}
        ownerId={ownerId}
        isBeheerder={isBeheerder}
      />
    </div>
  );
}
