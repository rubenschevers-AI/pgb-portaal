'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type Dienst = {
  id: string;
  datum: string;
  start_tijd: string;
  eind_tijd: string;
  notities: string | null;
  status: string;
  team_member_id: string | null;
};

type Aanmelding = {
  id: string;
  planning_id: string;
  team_member_id: string;
  status: string;
  gewijzigd_door_naam: string | null;
  created_at: string;
};

type TeamLid = { id: string; naam: string; rol: string; member_user_id: string | null };

type Props = {
  openDiensten: Dienst[];
  aanmeldingen: Aanmelding[];
  team: TeamLid[];
  userId: string;
  ownerId: string;
  isBeheerder: boolean;
  mijnTeamLidId: string | null;
};

const DAG_NAMEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MAAND_NAMEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function formatDatum(datum: string) {
  const d = new Date(datum + 'T00:00:00');
  const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
  const morgen = new Date(vandaag); morgen.setDate(morgen.getDate() + 1);
  if (d.getTime() === vandaag.getTime()) return 'Vandaag';
  if (d.getTime() === morgen.getTime()) return 'Morgen';
  return `${DAG_NAMEN[d.getDay()]} ${d.getDate()} ${MAAND_NAMEN[d.getMonth()]}`;
}

function duur(start: string, eind: string) {
  const s = new Date(`1970-01-01T${start}`);
  const e = new Date(`1970-01-01T${eind}`);
  const min = (e.getTime() - s.getTime()) / 60000;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}u ${m}m` : `${h}u`;
}

export default function OpenDienstenClient({
  openDiensten: initDiensten,
  aanmeldingen: initAanmeldingen,
  team,
  userId,
  ownerId,
  isBeheerder,
  mijnTeamLidId,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [diensten, setDiensten] = useState<Dienst[]>(initDiensten);
  const [aanmeldingen, setAanmeldingen] = useState<Aanmelding[]>(initAanmeldingen);
  const [loading, setLoading] = useState<string | null>(null);

  const teamMap = Object.fromEntries(team.map(t => [t.id, t]));

  const getAanmeldingenVoor = (dienstId: string) =>
    aanmeldingen.filter(a => a.planning_id === dienstId);

  const mijnAanmelding = (dienstId: string) =>
    mijnTeamLidId ? aanmeldingen.find(a => a.planning_id === dienstId && a.team_member_id === mijnTeamLidId) : null;

  /* ── Zorgverlener: aanmelden ── */
  const handleAanmelden = async (dienstId: string) => {
    if (!mijnTeamLidId) return;
    setLoading(dienstId);
    const { data, error } = await supabase
      .from('dienst_aanmeldingen')
      .insert({ planning_id: dienstId, team_member_id: mijnTeamLidId, status: 'aangemeld' })
      .select()
      .single();
    if (!error && data) {
      setAanmeldingen(prev => [...prev, data as Aanmelding]);
    }
    setLoading(null);
  };

  /* ── Zorgverlener: afmelden ── */
  const handleAfmelden = async (aanmeldingId: string, dienstId: string) => {
    setLoading(dienstId);
    await supabase.from('dienst_aanmeldingen').delete().eq('id', aanmeldingId);
    setAanmeldingen(prev => prev.filter(a => a.id !== aanmeldingId));
    setLoading(null);
  };

  /* ── Beheerder: aanmelding goedkeuren → dienst toewijzen ── */
  const handleGoedkeuren = async (aanmelding: Aanmelding) => {
    setLoading(aanmelding.id);

    // Update the planning record: assign team member + set status to ingepland
    await supabase
      .from('planning')
      .update({ team_member_id: aanmelding.team_member_id, status: 'ingepland' })
      .eq('id', aanmelding.planning_id);

    // Update aanmelding status
    await supabase
      .from('dienst_aanmeldingen')
      .update({ status: 'goedgekeurd' })
      .eq('id', aanmelding.id);

    // Reject other aanmeldingen for this shift
    await supabase
      .from('dienst_aanmeldingen')
      .update({ status: 'afgewezen' })
      .eq('planning_id', aanmelding.planning_id)
      .neq('id', aanmelding.id);

    // Update local state: remove shift from open list
    setDiensten(prev => prev.filter(d => d.id !== aanmelding.planning_id));
    setAanmeldingen(prev => prev.filter(a => a.planning_id !== aanmelding.planning_id));
    setLoading(null);
  };

  /* ── Beheerder: aanmelding afwijzen ── */
  const handleAfwijzen = async (aanmeldingId: string) => {
    setLoading(aanmeldingId);
    await supabase
      .from('dienst_aanmeldingen')
      .update({ status: 'afgewezen' })
      .eq('id', aanmeldingId);
    setAanmeldingen(prev =>
      prev.map(a => a.id === aanmeldingId ? { ...a, status: 'afgewezen' } : a)
    );
    setLoading(null);
  };

  if (diensten.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-semibold text-slate-700">Geen open diensten</p>
          <p className="text-sm text-slate-400 mt-1">Alle komende diensten zijn bezet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <p className="text-xs text-slate-400">
          {diensten.length} open {diensten.length === 1 ? 'dienst' : 'diensten'} beschikbaar
          {!isBeheerder && ' — meld je aan voor diensten die je kunt werken'}
        </p>

        {diensten.map(dienst => {
          const dienstAanmeldingen = getAanmeldingenVoor(dienst.id);
          const mijn = mijnAanmelding(dienst.id);
          const isLoading = loading === dienst.id || loading === (mijn?.id ?? '');
          const actieveAanmeldingen = dienstAanmeldingen.filter(a => a.status !== 'afgewezen');

          return (
            <div key={dienst.id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
              {/* Shift header */}
              <div className="px-5 py-4 border-b border-slate-50 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-sm font-bold text-slate-900">{formatDatum(dienst.datum)}</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {dienst.start_tijd.slice(0, 5)} – {dienst.eind_tijd.slice(0, 5)}
                    <span className="text-slate-400 ml-2">({duur(dienst.start_tijd, dienst.eind_tijd)})</span>
                  </p>
                  {dienst.notities && (
                    <p className="text-xs text-slate-400 mt-1">{dienst.notities}</p>
                  )}
                </div>

                {/* Zorgverlener: aanmeld button */}
                {!isBeheerder && mijnTeamLidId && (
                  <div className="shrink-0">
                    {mijn ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          mijn.status === 'goedgekeurd' ? 'bg-emerald-100 text-emerald-700' :
                          mijn.status === 'afgewezen' ? 'bg-red-100 text-red-600' :
                          'bg-indigo-100 text-indigo-700'
                        }`}>
                          {mijn.status === 'goedgekeurd' ? 'Toegewezen' :
                           mijn.status === 'afgewezen' ? 'Afgewezen' : 'Aangemeld'}
                        </span>
                        {mijn.status === 'aangemeld' && (
                          <button
                            onClick={() => handleAfmelden(mijn.id, dienst.id)}
                            disabled={!!isLoading}
                            className="text-xs text-slate-400 hover:text-red-500 transition"
                          >
                            Afmelden
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAanmelden(dienst.id)}
                        disabled={!!isLoading}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition flex items-center gap-1.5"
                      >
                        {isLoading && <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                        Aanmelden
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Beheerder: aanmeldingen list */}
              {isBeheerder && (
                <div className="px-5 py-3">
                  {actieveAanmeldingen.length === 0 ? (
                    <p className="text-xs text-slate-400 py-1">Nog geen aanmeldingen</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                        {actieveAanmeldingen.length} aanmelding{actieveAanmeldingen.length !== 1 ? 'en' : ''}
                      </p>
                      {actieveAanmeldingen.map(a => {
                        const lid = teamMap[a.team_member_id];
                        return (
                          <div key={a.id} className="flex items-center justify-between gap-3 py-1.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0">
                                {lid?.naam?.[0]?.toUpperCase() ?? '?'}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-800">{lid?.naam ?? 'Onbekend'}</p>
                                <p className="text-xs text-slate-400">{lid?.rol}</p>
                              </div>
                            </div>
                            {a.status === 'aangemeld' ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleGoedkeuren(a)}
                                  disabled={loading === a.id}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition"
                                >
                                  Toewijzen
                                </button>
                                <button
                                  onClick={() => handleAfwijzen(a.id)}
                                  disabled={loading === a.id}
                                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-medium transition"
                                >
                                  Afwijzen
                                </button>
                              </div>
                            ) : (
                              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                a.status === 'goedgekeurd' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                              }`}>
                                {a.status === 'goedgekeurd' ? 'Toegewezen' : 'Afgewezen'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
