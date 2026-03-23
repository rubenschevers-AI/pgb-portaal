import { createClient } from '@/lib/supabase/server';
import TakenClient from '@/components/taken/TakenClient';

export default async function TakenPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const vandaag = new Date().toISOString().split('T')[0];

  const { data: taken } = await supabase
    .from('taken')
    .select('*, taken_afvinkingen(id, datum, afgevinkt_door_naam)')
    .eq('owner_id', user!.id)
    .order('prioriteit')
    .order('titel');

  const { data: team } = await supabase
    .from('team_members')
    .select('id, naam')
    .eq('owner_id', user!.id)
    .eq('status', 'actief');

  return <TakenClient taken={taken ?? []} team={team ?? []} userId={user!.id} vandaag={vandaag} />;
}
