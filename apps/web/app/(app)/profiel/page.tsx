import { createClient } from '@/lib/supabase/server';
import ProfielClient from '@/components/profiel/ProfielClient';

export default async function ProfielPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profiel } = await supabase
    .from('profiles')
    .select('voornaam, achternaam, email')
    .eq('user_id', user!.id)
    .single();

  return (
    <ProfielClient
      userId={user!.id}
      email={user!.email ?? ''}
      voornaam={profiel?.voornaam ?? ''}
      achternaam={profiel?.achternaam ?? ''}
    />
  );
}
