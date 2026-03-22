import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Haal vandaag's diensten op
  const today = new Date().toISOString().split('T')[0];
  const { data: diensten } = await supabase
    .from('planning')
    .select('*, team_members(naam)')
    .eq('owner_id', user!.id)
    .eq('datum', today)
    .order('start_tijd');

  // Haal team op
  const { data: team } = await supabase
    .from('team_members')
    .select('id, naam, rol, status')
    .eq('owner_id', user!.id)
    .eq('status', 'actief');

  // Haal recente taken op
  const { data: taken } = await supabase
    .from('taken')
    .select('id, titel, categorie, is_actief')
    .eq('owner_id', user!.id)
    .eq('is_actief', true)
    .limit(5);

  const dienstCount = diensten?.length ?? 0;
  const teamCount = team?.length ?? 0;
  const takenCount = taken?.length ?? 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          {new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard icon="📅" label="Diensten vandaag" value={dienstCount} color="indigo" />
        <StatCard icon="👥" label="Actieve zorgverleners" value={teamCount} color="emerald" />
        <StatCard icon="✅" label="Actieve taken" value={takenCount} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Diensten vandaag */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Diensten vandaag</h2>
          {diensten && diensten.length > 0 ? (
            <div className="space-y-3">
              {diensten.map((d: any) => (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
                    {d.team_members?.naam?.[0] ?? '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{d.team_members?.naam ?? 'Open dienst'}</p>
                    <p className="text-xs text-gray-500">{d.start_tijd?.slice(0, 5)} – {d.eind_tijd?.slice(0, 5)}</p>
                  </div>
                  <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${
                    d.status === 'bevestigd' ? 'bg-green-100 text-green-700' :
                    d.status === 'open' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">Geen diensten gepland voor vandaag</p>
          )}
        </div>

        {/* Team */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Mijn team</h2>
          {team && team.length > 0 ? (
            <div className="space-y-3">
              {team.map((lid: any) => (
                <div key={lid.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700">
                    {lid.naam?.[0] ?? '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{lid.naam}</p>
                    <p className="text-xs text-gray-500">{lid.rol}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400 mb-3">Nog geen zorgverleners toegevoegd</p>
              <a href="/team" className="text-sm text-indigo-600 font-medium hover:underline">
                Team beheren →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3 ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}
