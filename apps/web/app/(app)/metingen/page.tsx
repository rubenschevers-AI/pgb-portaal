import { createClient } from '@/lib/supabase/server';
import MetingenClient from '@/components/metingen/MetingenClient';
import SectionTabs from '@/components/layout/SectionTabs';

const TABS = [
  { href: '/metingen', label: 'Metingen' },
  { href: '/medicatie', label: 'Medicatie' },
];

export default async function MetingenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ownerIdData } = await supabase.rpc('my_owner_id');
  const ownerId = (ownerIdData as string) ?? user!.id;
  const isBeheerder = ownerId === user!.id;

  // For zorgverlener: get their own naam
  let eigenNaam: string | null = null;
  if (!isBeheerder) {
    const { data: lid } = await supabase
      .from('team_members')
      .select('naam')
      .eq('owner_id', ownerId)
      .eq('member_user_id', user!.id)
      .single();
    eigenNaam = lid?.naam ?? null;
  }

  const { data: metingen } = await supabase
    .from('metingen')
    .select('id, type, waarde, eenheid, datum, tijdstip, notities, gemeten_door_naam, created_at')
    .eq('owner_id', ownerId)
    .order('datum', { ascending: false })
    .order('tijdstip', { ascending: false });

  return (
    <div className="flex flex-col h-full">
      <SectionTabs tabs={TABS} />
      <MetingenClient
        metingen={metingen ?? []}
        userId={user!.id}
        ownerId={ownerId}
        isBeheerder={isBeheerder}
        eigenNaam={eigenNaam}
      />
    </div>
  );
}
