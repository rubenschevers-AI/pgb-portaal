import { createClient } from '@/lib/supabase/server';
import TakenClient from '@/components/taken/TakenClient';

export default async function TakenPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const vandaag = new Date().toISOString().split('T')[0];

  const { data: ownerIdData } = await supabase.rpc('my_owner_id');
  const ownerId = (ownerIdData as string) ?? user!.id;
  const isBeheerder = ownerId === user!.id;

  const takenQuery = supabase
    .from('taken')
    .select('*, taken_afvinkingen(id, datum, afgevinkt_door_naam)')
    .eq('owner_id', ownerId)
    .order('prioriteit')
    .order('titel');

  const { data: taken } = await takenQuery;

  const { data: team } = isBeheerder
    ? await supabase
        .from('team_members')
        .select('id, naam')
        .eq('owner_id', ownerId)
        .eq('status', 'actief')
    : { data: [] };

  return (
    <TakenClient
      taken={taken ?? []}
      team={team ?? []}
      userId={user!.id}
      vandaag={vandaag}
      isBeheerder={isBeheerder}
    />
  );
}
