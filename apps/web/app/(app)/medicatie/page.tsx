import { createClient } from '@/lib/supabase/server';
import MedicatieClient from '@/components/medicatie/MedicatieClient';
import SectionTabs from '@/components/layout/SectionTabs';

const TABS = [
  { href: '/metingen', label: 'Metingen' },
  { href: '/medicatie', label: 'Medicatie' },
];

export default async function MedicatiePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const vandaag = new Date().toISOString().split('T')[0];

  const zeven = new Date();
  zeven.setDate(zeven.getDate() - 6);
  const vanafDatum = zeven.toISOString().split('T')[0];

  const { data: medicatie } = await supabase
    .from('medicatie')
    .select('*')
    .eq('owner_id', user!.id)
    .order('naam');

  const { data: toedieningen } = await supabase
    .from('medicatie_toedieningen')
    .select('*')
    .eq('owner_id', user!.id)
    .gte('datum', vanafDatum)
    .order('datum', { ascending: false });

  return (
    <div className="flex flex-col h-full">
      <SectionTabs tabs={TABS} />
      <MedicatieClient
        medicatie={medicatie ?? []}
        toedieningen={toedieningen ?? []}
        userId={user!.id}
        vandaag={vandaag}
        vanafDatum={vanafDatum}
      />
    </div>
  );
}
