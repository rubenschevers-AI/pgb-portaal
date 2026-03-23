import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import DevSwitcher from '@/components/dev/DevSwitcher';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profiel }, { data: devAccounts }] = await Promise.all([
    supabase
      .from('profiles')
      .select('voornaam, achternaam')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('dev_test_accounts')
      .select('id, label, email, rol')
      .order('rol'),
  ]);

  const displayNaam = profiel?.voornaam
    ? `${profiel.voornaam}${profiel.achternaam ? ' ' + profiel.achternaam : ''}`
    : null;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar user={user} displayNaam={displayNaam} />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {children}
      </main>
      <DevSwitcher accounts={devAccounts ?? []} />
    </div>
  );
}
