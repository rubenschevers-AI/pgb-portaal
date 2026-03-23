import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import DashboardTakenWidget from '@/components/dashboard/DashboardTakenWidget';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const today = new Date().toISOString().split('T')[0];

  // Determine role
  const { data: ownerIdData } = await supabase.rpc('my_owner_id');
  const ownerId = (ownerIdData as string) ?? user!.id;
  const isBeheerder = ownerId === user!.id;

  // Get current user's team_member record (for zorgverleners)
  const { data: mijnTeamLid } = !isBeheerder
    ? await supabase.from('team_members').select('id, naam, rol').eq('member_user_id', user!.id).single()
    : { data: null };

  const [
    { data: diensten },
    { data: openDiensten },
    { data: team },
    { data: taken },
    { data: profiel },
    { data: clientProfiel },
    { data: mijnAanmeldingen },
  ] = await Promise.all([
    // Diensten vandaag — RLS auto-filters: beheerder sees all, zorgverlener sees own
    supabase.from('planning')
      .select('id, start_tijd, eind_tijd, status, notities, team_members(naam, rol)')
      .eq('datum', today)
      .neq('status', 'open')
      .order('start_tijd'),

    // Open diensten (komende 14 dagen)
    supabase.from('planning')
      .select('id, datum, start_tijd, eind_tijd, notities')
      .eq('owner_id', ownerId)
      .eq('status', 'open')
      .gte('datum', today)
      .order('datum')
      .limit(5),

    // Team overview (beheerder only — zorgverleners see own row via RLS)
    supabase.from('team_members')
      .select('id, naam, rol, status')
      .eq('owner_id', ownerId)
      .eq('status', 'actief')
      .order('naam'),

    // Taken — RLS handles access
    supabase.from('taken')
      .select('id, titel, prioriteit, status, taken_afvinkingen(id, datum)')
      .eq('owner_id', ownerId)
      .eq('status', 'actief')
      .order('prioriteit')
      .limit(6),

    // Own profile
    supabase.from('profiles').select('voornaam').eq('user_id', user!.id).single(),

    // Client profiel (for zorgverleners)
    supabase.from('client_profiel')
      .select('naam, omschrijving, bijzonderheden')
      .eq('owner_id', ownerId)
      .maybeSingle(),

    // Mijn aanmeldingen voor open diensten
    mijnTeamLid?.id
      ? supabase.from('dienst_aanmeldingen')
          .select('planning_id, status')
          .eq('team_member_id', mijnTeamLid.id)
      : Promise.resolve({ data: [] }),
  ]);

  const nu = new Date();
  const uur = nu.getHours();
  const dagdeel = uur < 12 ? 'Goedemorgen' : uur < 18 ? 'Goedemiddag' : 'Goedenavond';
  const welkomNaam = profiel?.voornaam ? `, ${profiel.voornaam}` : '';

  const dienstCount = diensten?.length ?? 0;
  const openCount = openDiensten?.length ?? 0;
  const teamCount = team?.length ?? 0;
  const takenActief = taken?.length ?? 0;
  const takenVandaag = taken?.filter((t: any) => t.taken_afvinkingen?.some((a: any) => a.datum === today)).length ?? 0;

  const aangemeldIds = new Set((mijnAanmeldingen ?? []).map((a: any) => a.planning_id));

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-slate-400 font-medium mb-1">
          {nu.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
          {dagdeel}{welkomNaam} 👋
        </h1>
        {!isBeheerder && mijnTeamLid && (
          <p className="text-sm text-slate-400 mt-1">{mijnTeamLid.rol}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard
          label={isBeheerder ? 'Diensten vandaag' : 'Mijn diensten'}
          value={dienstCount}
          icon={<IconCalendar />}
          color="indigo"
          href="/planning"
        />
        {isBeheerder ? (
          <StatCard
            label="Zorgverleners"
            value={teamCount}
            icon={<IconTeam />}
            color="emerald"
            href="/team"
          />
        ) : (
          <StatCard
            label="Open diensten"
            value={openCount}
            icon={<IconCalendar />}
            color="amber"
            href="/open-diensten"
            highlight={openCount > 0}
          />
        )}
        <StatCard
          label={`${takenVandaag}/${takenActief} taken`}
          value={null}
          icon={<IconTaken />}
          color="amber"
          href="/taken"
          progress={takenActief > 0 ? takenVandaag / takenActief : 0}
        />
      </div>

      {/* Open diensten alert (beheerder: if any exist) */}
      {isBeheerder && openCount > 0 && (
        <Link href="/open-diensten" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-5 hover:bg-amber-100 transition group">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {openCount} open {openCount === 1 ? 'dienst' : 'diensten'} wachten op invulling
            </p>
            <p className="text-xs text-amber-600">Zorgverleners kunnen zich aanmelden</p>
          </div>
          <svg className="w-4 h-4 text-amber-400 group-hover:text-amber-600 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Diensten vandaag */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-800 text-sm">
              {isBeheerder ? 'Diensten vandaag' : 'Mijn diensten vandaag'}
            </h2>
            <Link href="/planning" className="text-xs text-indigo-600 font-medium hover:text-indigo-700">
              Alle diensten →
            </Link>
          </div>
          {diensten && diensten.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {diensten.map((d: any) => (
                <div key={d.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0">
                    {isBeheerder
                      ? (d.team_members?.naam?.[0] ?? '?')
                      : (nu.getHours() >= parseInt(d.start_tijd) ? '✓' : '→')
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {isBeheerder ? (d.team_members?.naam ?? 'Open dienst') : (d.notities ?? 'Dienst')}
                    </p>
                    <p className="text-xs text-slate-400">{d.start_tijd?.slice(0, 5)} – {d.eind_tijd?.slice(0, 5)}</p>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-slate-400">Geen diensten vandaag</p>
            </div>
          )}
        </div>

        {/* Taken — interactief widget */}
        <DashboardTakenWidget
          taken={(taken ?? []).map((t: any) => ({
            id: t.id,
            titel: t.titel,
            prioriteit: t.prioriteit,
            status: t.status,
            gedaanVandaag: t.taken_afvinkingen?.some((a: any) => a.datum === today) ?? false,
          }))}
          vandaag={today}
          userId={user!.id}
        />

        {/* Open diensten voor zorgverlener */}
        {!isBeheerder && openCount > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <h2 className="font-semibold text-slate-800 text-sm">Beschikbare diensten</h2>
              <Link href="/open-diensten" className="text-xs text-indigo-600 font-medium hover:text-indigo-700">
                Bekijk alle →
              </Link>
            </div>
            <div className="divide-y divide-slate-50">
              {(openDiensten ?? []).slice(0, 4).map((d: any) => {
                const aangemeld = aangemeldIds.has(d.id);
                const dd = new Date(d.datum + 'T00:00:00');
                return (
                  <div key={d.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-xs font-bold text-amber-600 shrink-0">
                      {dd.getDate()}/{dd.getMonth() + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {d.start_tijd?.slice(0, 5)} – {d.eind_tijd?.slice(0, 5)}
                      </p>
                      {d.notities && <p className="text-xs text-slate-400 truncate">{d.notities}</p>}
                    </div>
                    {aangemeld && (
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0">Aangemeld</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cliënt info (zorgverlener) */}
        {!isBeheerder && clientProfiel && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <h2 className="font-semibold text-slate-800 text-sm">Over de cliënt</h2>
              <Link href="/client" className="text-xs text-indigo-600 font-medium hover:text-indigo-700">
                Volledig profiel →
              </Link>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm font-semibold text-slate-800 mb-1">{clientProfiel.naam ?? 'Cliënt'}</p>
              {clientProfiel.omschrijving && (
                <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed">{clientProfiel.omschrijving}</p>
              )}
            </div>
          </div>
        )}

        {/* Team (beheerder only) */}
        {isBeheerder && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden lg:col-span-2">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <h2 className="font-semibold text-slate-800 text-sm">Mijn team</h2>
              <Link href="/team" className="text-xs text-indigo-600 font-medium hover:text-indigo-700">
                Team beheren →
              </Link>
            </div>
            {team && team.length > 0 ? (
              <div className="flex flex-wrap gap-3 p-5">
                {team.map((lid: any) => (
                  <div key={lid.id} className="flex items-center gap-2.5 bg-slate-50 rounded-xl px-3 py-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
                      {lid.naam?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 leading-tight">{lid.naam}</p>
                      <p className="text-xs text-slate-400 leading-tight">{lid.rol}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-slate-400">Nog geen zorgverleners toegevoegd</p>
                <Link href="/team" className="mt-2 inline-block text-xs text-indigo-600 font-medium hover:text-indigo-700">
                  Teamlid toevoegen →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon, color, href, progress, highlight,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  color: 'indigo' | 'emerald' | 'amber';
  href: string;
  progress?: number;
  highlight?: boolean;
}) {
  const colors = {
    indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', bar: 'bg-indigo-500' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', bar: 'bg-emerald-500' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', bar: 'bg-amber-500' },
  };
  const c = colors[color];
  return (
    <Link href={href} className={`bg-white rounded-2xl border shadow-sm p-4 md:p-5 flex flex-col gap-3 hover:shadow-md transition-shadow ${highlight ? 'border-amber-200' : 'border-slate-100'}`}>
      <div className={`w-9 h-9 rounded-xl ${c.bg} ${c.icon} flex items-center justify-center`}>
        {icon}
      </div>
      {value !== null ? (
        <p className="text-2xl md:text-3xl font-bold text-slate-900">{value}</p>
      ) : progress !== undefined ? (
        <div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${c.bar} rounded-full transition-all`} style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="text-xs text-slate-400 mt-1">{Math.round(progress * 100)}% gedaan</p>
        </div>
      ) : null}
      <p className="text-xs text-slate-500 font-medium">{label}</p>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ingepland: 'bg-blue-50 text-blue-600',
    bezig: 'bg-amber-50 text-amber-600',
    afgerond: 'bg-emerald-50 text-emerald-600',
    afgemeld: 'bg-red-50 text-red-500',
    open: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[status] ?? map.open}`}>
      {status}
    </span>
  );
}

function PrioriteitDot({ prioriteit }: { prioriteit?: string }) {
  const map: Record<string, string> = {
    urgent: 'bg-red-500', hoog: 'bg-orange-400', normaal: 'bg-blue-400', laag: 'bg-slate-300',
  };
  return <div className={`w-2 h-2 rounded-full shrink-0 ${map[prioriteit ?? 'normaal']}`} />;
}

function IconCalendar() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function IconTeam() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
function IconTaken() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
