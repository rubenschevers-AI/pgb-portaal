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

  const { data: metingen } = await supabase
    .from('metingen')
    .select('id, type, waarde, eenheid, datum, tijdstip, notities, gemeten_door_naam, created_at')
    .eq('owner_id', user!.id)
    .order('datum', { ascending: false })
    .order('tijdstip', { ascending: false });

  return (
    <div className="flex flex-col h-full">
      <SectionTabs tabs={TABS} />
      <MetingenClient
        metingen={metingen ?? []}
        userId={user!.id}
      />
    </div>
  );
}
