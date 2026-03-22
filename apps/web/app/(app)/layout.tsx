import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar user={user} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
