'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Dienst = {
  id: string;
  datum: string;
  start_tijd: string;
  eind_tijd: string;
  status: string;
  notities?: string;
  team_members?: { id: string; naam: string; rol: string } | null;
  team_member_id: string | null;
};

type TeamLid = { id: string; naam: string; rol: string };

type BasisroosterSlot = {
  id: string;
  dag_van_week: number;
  start_tijd: string;
  eind_tijd: string;
  team_member_id: string | null;
  notities: string;
};

const STATUSSEN = ['ingepland', 'bezig', 'afgerond', 'afgemeld'] as const;

const STATUS_STIJL: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  ingepland: { bg: 'bg-indigo-50',   text: 'text-indigo-700',   dot: 'bg-indigo-500',   border: 'border-indigo-200' },
  bezig:     { bg: 'bg-amber-50',    text: 'text-amber-700',    dot: 'bg-amber-400',    border: 'border-amber-200'  },
  afgerond:  { bg: 'bg-emerald-50',  text: 'text-emerald-700',  dot: 'bg-emerald-500',  border: 'border-emerald-200'},
  afgemeld:  { bg: 'bg-red-50',      text: 'text-red-600',      dot: 'bg-red-400',      border: 'border-red-200'    },
  open:      { bg: 'bg-amber-50',    text: 'text-amber-700',    dot: 'bg-amber-400',    border: 'border-amber-300'  },
};

const DAG_NAMEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MAAND_NAMEN = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
const MAAND_KORT = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
// basisrooster: 1=ma…7=zo → JS getDay: 0=zo,1=ma…6=za
const BASIS_DAG_MAP: Record<number, number> = { 1:1, 2:2, 3:3, 4:4, 5:5, 6:6, 7:0 };

function startVanWeek(d: Date): Date {
  const dag = new Date(d);
  const diff = dag.getDay() === 0 ? -6 : 1 - dag.getDay();
  dag.setDate(dag.getDate() + diff);
  dag.setHours(0,0,0,0);
  return dag;
}

function startVanMaand(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isoDate(d: Date) { return d.toISOString().split('T')[0]; }

export default function PlanningClient({
  diensten: initDiensten,
  team,
  userId,
  ownerId,
  basisrooster,
  isBeheerder = true,
}: {
  diensten: Dienst[];
  team: TeamLid[];
  userId: string;
  ownerId: string;
  basisrooster: BasisroosterSlot[];
  isBeheerder?: boolean;
}) {
  const [diensten, setDiensten] = useState<Dienst[]>(initDiensten);
  const [view, setView] = useState<'week' | 'month'>('week');
  const [weekStart, setWeekStart] = useState(() => startVanWeek(new Date()));
  const [maandStart, setMaandStart] = useState(() => startVanMaand(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [selectedDatum, setSelectedDatum] = useState(() => isoDate(new Date()));
  const [teamMemberId, setTeamMemberId] = useState('');
  const [startTijd, setStartTijd] = useState('08:00');
  const [eindTijd, setEindTijd] = useState('12:00');
  const [notities, setNotities] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailDienst, setDetailDienst] = useState<Dienst | null>(null);
  const [toewijzenLid, setToewijzenLid] = useState('');
  const [toewijzenLoading, setToewijzenLoading] = useState(false);
  const [roosterToepassen, setRoosterToepassen] = useState(false);
  const [roosterWeekStart, setRoosterWeekStart] = useState(() => isoDate(startVanWeek(new Date())));
  const [roosterLoading, setRoosterLoading] = useState(false);
  const [roosterResultaat, setRoosterResultaat] = useState<string | null>(null);
  const supabase = createClient();

  const vandaag = isoDate(new Date());

  // ── Week helpers ─────────────────────────────────────────
  const weekDagen: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });

  const vorigeWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); };
  const volgendeWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); };

  const weekLabel = (() => {
    const s = weekDagen[0], e = weekDagen[6];
    if (s.getMonth() === e.getMonth())
      return `${s.getDate()} – ${e.getDate()} ${MAAND_KORT[e.getMonth()]} ${e.getFullYear()}`;
    return `${s.getDate()} ${MAAND_KORT[s.getMonth()]} – ${e.getDate()} ${MAAND_KORT[e.getMonth()]} ${e.getFullYear()}`;
  })();

  // ── Maand helpers ─────────────────────────────────────────
  const vorigeMaand = () => setMaandStart(new Date(maandStart.getFullYear(), maandStart.getMonth() - 1, 1));
  const volgendeMaand = () => setMaandStart(new Date(maandStart.getFullYear(), maandStart.getMonth() + 1, 1));

  const maandLabel = `${MAAND_NAMEN[maandStart.getMonth()]} ${maandStart.getFullYear()}`;

  // Build maand grid: maandag t/m zondag rijen
  const getMaandDagen = () => {
    const year = maandStart.getFullYear();
    const month = maandStart.getMonth();
    const eersteVanMaand = new Date(year, month, 1);
    const eersteWeekdag = eersteVanMaand.getDay(); // 0=zo
    // Hoeveel dagen voor de eerste (maandag = start)
    const offset = eersteWeekdag === 0 ? 6 : eersteWeekdag - 1;
    const startDag = new Date(eersteVanMaand);
    startDag.setDate(startDag.getDate() - offset);

    const dagen: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDag);
      d.setDate(d.getDate() + i);
      dagen.push(d);
    }
    // Snij af op precies 5 of 6 weken
    const aantalWeken = dagen[34].getMonth() !== month ? 5 : 6;
    return dagen.slice(0, aantalWeken * 7);
  };

  const maandDagen = getMaandDagen();

  // ── Diensten per dag index ────────────────────────────────
  const dienstenPerDag: Record<string, Dienst[]> = {};
  for (const d of diensten) {
    if (!dienstenPerDag[d.datum]) dienstenPerDag[d.datum] = [];
    dienstenPerDag[d.datum].push(d);
  }

  // ── Nav label ────────────────────────────────────────────
  const navLabel = view === 'week' ? weekLabel : maandLabel;
  const handleVorige = view === 'week' ? vorigeWeek : vorigeMaand;
  const handleVolgende = view === 'week' ? volgendeWeek : volgendeMaand;
  const handleVandaag = () => {
    if (view === 'week') setWeekStart(startVanWeek(new Date()));
    else setMaandStart(startVanMaand(new Date()));
  };

  // ── Dienst toevoegen ─────────────────────────────────────
  const handleToevoegen = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const status = teamMemberId ? 'ingepland' : 'open';
    const { data, error } = await supabase
      .from('planning')
      .insert({
        datum: selectedDatum,
        start_tijd: startTijd,
        eind_tijd: eindTijd,
        team_member_id: teamMemberId || null,
        notities: notities || null,
        status,
        owner_id: ownerId,
      })
      .select('*, team_members(id, naam, rol)')
      .single();
    if (!error && data) setDiensten(prev => [...prev, data as Dienst]);
    setNotities(''); setShowForm(false); setLoading(false);
  };

  // ── Status wijzigen ──────────────────────────────────────
  const handleStatusWijzig = async (dienst: Dienst, nieuweStatus: string) => {
    setDiensten(prev => prev.map(d => d.id === dienst.id ? { ...d, status: nieuweStatus } : d));
    await supabase.from('planning').update({ status: nieuweStatus }).eq('id', dienst.id);
    if (detailDienst?.id === dienst.id) setDetailDienst({ ...detailDienst, status: nieuweStatus });
  };

  // ── Toewijzen aan zorgverlener ───────────────────────────
  const handleToewijzen = async () => {
    if (!detailDienst || !toewijzenLid) return;
    setToewijzenLoading(true);
    const { data } = await supabase
      .from('planning')
      .update({ team_member_id: toewijzenLid, status: 'ingepland' })
      .eq('id', detailDienst.id)
      .select('*, team_members(id, naam, rol)')
      .single();
    if (data) {
      setDiensten(prev => prev.map(d => d.id === detailDienst.id ? data as Dienst : d));
      setDetailDienst(data as Dienst);
    }
    setToewijzenLoading(false);
  };

  // ── Verwijderen ──────────────────────────────────────────
  const handleVerwijder = async (id: string) => {
    if (!confirm('Dienst verwijderen?')) return;
    setDiensten(prev => prev.filter(d => d.id !== id));
    setDetailDienst(null);
    await supabase.from('planning').delete().eq('id', id);
  };

  // ── Basisrooster toepassen op week ───────────────────────
  const handleRoosterToepassen = async () => {
    if (basisrooster.length === 0) return;
    setRoosterLoading(true);
    setRoosterResultaat(null);

    const weekStartDate = new Date(roosterWeekStart + 'T00:00:00');
    const aangemaakt: Dienst[] = [];
    let overgeslagen = 0;

    for (const slot of basisrooster) {
      const jsDag = BASIS_DAG_MAP[slot.dag_van_week];
      const dagOffset = (jsDag - 1 + 7) % 7;
      const datum = new Date(weekStartDate);
      datum.setDate(datum.getDate() + dagOffset);
      const datumStr = isoDate(datum);

      const bestaatAl = diensten.some(
        d => d.datum === datumStr &&
             d.start_tijd.slice(0,5) === slot.start_tijd.slice(0,5) &&
             d.eind_tijd.slice(0,5) === slot.eind_tijd.slice(0,5)
      );

      if (bestaatAl) { overgeslagen++; continue; }

      const status = slot.team_member_id ? 'ingepland' : 'open';
      const { data, error } = await supabase
        .from('planning')
        .insert({
          datum: datumStr,
          start_tijd: slot.start_tijd,
          eind_tijd: slot.eind_tijd,
          team_member_id: slot.team_member_id || null,
          notities: slot.notities || null,
          status,
          owner_id: ownerId,
        })
        .select('*, team_members(id, naam, rol)')
        .single();
      if (!error && data) aangemaakt.push(data as Dienst);
    }

    if (aangemaakt.length > 0) setDiensten(prev => [...prev, ...aangemaakt]);
    setWeekStart(weekStartDate);
    setView('week');
    setRoosterResultaat(
      aangemaakt.length === 0
        ? 'Alle tijdsloten bestonden al voor deze week.'
        : `${aangemaakt.length} dienst${aangemaakt.length > 1 ? 'en' : ''} aangemaakt${overgeslagen > 0 ? `, ${overgeslagen} overgeslagen` : ''}.`
    );
    setRoosterLoading(false);
    setTimeout(() => { setRoosterToepassen(false); setRoosterResultaat(null); }, 3000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 md:px-8 py-4 bg-white border-b border-slate-100 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Planning</h1>
          <p className="text-xs text-slate-400 mt-0.5">{navLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Week/Maand toggle */}
          <div className="flex bg-slate-100 rounded-xl p-0.5">
            <button
              onClick={() => setView('week')}
              className={`px-3 h-7 rounded-[10px] text-xs font-medium transition ${view === 'week' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Week
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-3 h-7 rounded-[10px] text-xs font-medium transition ${view === 'month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Maand
            </button>
          </div>

          {/* Navigatie */}
          <button onClick={handleVorige} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition">‹</button>
          <button onClick={handleVandaag} className="px-3 h-8 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">Vandaag</button>
          <button onClick={handleVolgende} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition">›</button>

          {isBeheerder && basisrooster.length > 0 && (
            <button
              onClick={() => setRoosterToepassen(!roosterToepassen)}
              className="ml-1 px-3 h-8 rounded-xl border border-indigo-200 bg-indigo-50 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition hidden md:inline-flex items-center"
            >
              Basisrooster toepassen
            </button>
          )}
          {isBeheerder && (
            <button
              onClick={() => { setShowForm(!showForm); setSelectedDatum(vandaag); setTeamMemberId(''); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 h-8 rounded-xl text-xs transition"
            >
              + Dienst
            </button>
          )}
        </div>
      </div>

      {/* ── Basisrooster toepassen panel ── */}
      {roosterToepassen && (
        <div className="bg-indigo-50 border-b border-indigo-100 px-4 md:px-8 py-4">
          <p className="text-sm font-semibold text-indigo-800 mb-3">Basisrooster toepassen op week</p>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-indigo-700 mb-1">Weekstart (maandag)</label>
              <input
                type="date"
                value={roosterWeekStart}
                onChange={e => setRoosterWeekStart(e.target.value)}
                className="px-3 py-2 bg-white border border-indigo-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={handleRoosterToepassen}
              disabled={roosterLoading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-sm transition"
            >
              {roosterLoading ? 'Bezig...' : `${basisrooster.length} slot${basisrooster.length > 1 ? 's' : ''} toepassen`}
            </button>
            <button onClick={() => setRoosterToepassen(false)} className="px-3 py-2 text-sm text-indigo-600 hover:text-indigo-800 transition">Annuleren</button>
          </div>
          {roosterResultaat && (
            <p className="mt-2 text-sm text-indigo-700 font-medium">{roosterResultaat}</p>
          )}
        </div>
      )}

      {/* ── Dienst toevoegen formulier ── */}
      {showForm && (
        <div className="bg-slate-50 border-b border-slate-100 px-4 md:px-8 py-5">
          <form onSubmit={handleToevoegen} className="max-w-2xl">
            <h2 className="font-semibold text-slate-800 mb-4 text-sm">Nieuwe dienst inplannen</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Datum *</label>
                <input type="date" value={selectedDatum} onChange={e => setSelectedDatum(e.target.value)} required
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Zorgverlener</label>
                <select value={teamMemberId} onChange={e => setTeamMemberId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">— Open dienst —</option>
                  {team.map(l => <option key={l.id} value={l.id}>{l.naam}</option>)}
                </select>
                {!teamMemberId && <p className="text-[10px] text-amber-600 mt-0.5">Zonder zorgverlener = open dienst</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notitie</label>
                <input type="text" value={notities} onChange={e => setNotities(e.target.value)} placeholder="Optioneel..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Starttijd *</label>
                <input type="time" value={startTijd} onChange={e => setStartTijd(e.target.value)} required
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Eindtijd *</label>
                <input type="time" value={eindTijd} onChange={e => setEindTijd(e.target.value)} required
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="submit" disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-sm transition">
                {loading ? 'Opslaan...' : teamMemberId ? 'Inplannen' : 'Open dienst aanmaken'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100 transition">Annuleren</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Kalender ── */}
      <div className="flex-1 overflow-hidden flex flex-col px-4 md:px-8 py-5 max-w-7xl mx-auto w-full">
        {view === 'week' ? (
          <WeekView
            weekDagen={weekDagen}
            vandaag={vandaag}
            dienstenPerDag={dienstenPerDag}
            onDienstClick={d => { setDetailDienst(d); setToewijzenLid(team[0]?.id ?? ''); }}
            onAddClick={iso => { setSelectedDatum(iso); setShowForm(true); }}
          />
        ) : (
          <MaandView
            maandDagen={maandDagen}
            maandStart={maandStart}
            vandaag={vandaag}
            dienstenPerDag={dienstenPerDag}
            onDienstClick={d => { setDetailDienst(d); setToewijzenLid(team[0]?.id ?? ''); }}
            onDagClick={iso => { setSelectedDatum(iso); setShowForm(true); }}
          />
        )}
      </div>

      {/* ── Detail panel ── */}
      {detailDienst && (
        <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center" onClick={() => setDetailDienst(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative z-50 bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-w-md mx-0 md:mx-4 p-6"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-start justify-between mb-4">
              <div>
                {!detailDienst.team_member_id || detailDienst.status === 'open' ? (
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full mb-1">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      Open dienst
                    </span>
                    <p className="text-xs text-slate-400 mt-1">Nog geen zorgverlener toegewezen</p>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{detailDienst.team_members?.naam}</h2>
                    <p className="text-sm text-slate-400">{detailDienst.team_members?.rol}</p>
                  </div>
                )}
              </div>
              <button onClick={() => setDetailDienst(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition text-lg">×</button>
            </div>

            <div className="space-y-2 mb-5">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="text-slate-400 w-5">📅</span>
                <span>{new Date(detailDienst.datum + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="text-slate-400 w-5">⏰</span>
                <span>{detailDienst.start_tijd.slice(0,5)} – {detailDienst.eind_tijd.slice(0,5)}</span>
              </div>
              {detailDienst.notities && (
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-slate-400 w-5 mt-0.5">📝</span>
                  <span>{detailDienst.notities}</span>
                </div>
              )}
            </div>

            {(!detailDienst.team_member_id || detailDienst.status === 'open') && team.length > 0 && (
              <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <p className="text-xs font-semibold text-amber-800 mb-2">Toewijzen aan zorgverlener</p>
                <div className="flex gap-2">
                  <select
                    value={toewijzenLid}
                    onChange={e => setToewijzenLid(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-amber-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">— Kies zorgverlener —</option>
                    {team.map(l => <option key={l.id} value={l.id}>{l.naam}</option>)}
                  </select>
                  <button
                    onClick={handleToewijzen}
                    disabled={!toewijzenLid || toewijzenLoading}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-sm transition"
                  >
                    {toewijzenLoading ? '...' : 'Toewijzen'}
                  </button>
                </div>
              </div>
            )}

            {detailDienst.team_member_id && detailDienst.status !== 'open' && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {STATUSSEN.map(s => {
                    const stijl = STATUS_STIJL[s];
                    const actief = detailDienst.status === s;
                    return (
                      <button key={s} onClick={() => handleStatusWijzig(detailDienst, s)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                          actief ? `${stijl.bg} ${stijl.text} ${stijl.border}` : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${actief ? stijl.dot : 'bg-slate-300'}`} />
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button onClick={() => handleVerwijder(detailDienst.id)}
              className="w-full py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition">
              Dienst verwijderen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Week View ─────────────────────────────────────────────
function WeekView({
  weekDagen, vandaag, dienstenPerDag, onDienstClick, onAddClick,
}: {
  weekDagen: Date[];
  vandaag: string;
  dienstenPerDag: Record<string, Dienst[]>;
  onDienstClick: (d: Dienst) => void;
  onAddClick: (iso: string) => void;
}) {
  return (
    <>
      {/* Desktop 7-kolommen grid */}
      <div className="flex-1 hidden md:grid md:grid-cols-7 gap-2" style={{ gridAutoRows: '1fr' }}>
        {weekDagen.map(dag => {
          const iso = isoDate(dag);
          const isVandaag = iso === vandaag;
          const dagDiensten = (dienstenPerDag[iso] ?? []).sort((a,b) => a.start_tijd.localeCompare(b.start_tijd));
          const openCount = dagDiensten.filter(d => !d.team_member_id || d.status === 'open').length;
          return (
            <div key={iso} className={`flex flex-col rounded-2xl border overflow-hidden ${isVandaag ? 'border-indigo-300 ring-1 ring-indigo-300' : 'border-slate-100'}`}>
              <div className={`px-3 py-2.5 border-b ${isVandaag ? 'bg-indigo-600 border-indigo-500' : 'bg-white border-slate-50'}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-wide ${isVandaag ? 'text-indigo-200' : 'text-slate-400'}`}>{DAG_NAMEN[dag.getDay()]}</p>
                <p className={`text-xl font-bold leading-tight ${isVandaag ? 'text-white' : 'text-slate-800'}`}>{dag.getDate()}</p>
                <p className={`text-[10px] ${isVandaag ? 'text-indigo-200' : 'text-slate-400'}`}>{MAAND_KORT[dag.getMonth()]}</p>
                {openCount > 0 && (
                  <span className="inline-block mt-1 text-[9px] font-bold bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full">
                    {openCount} open
                  </span>
                )}
              </div>
              <div className={`flex-1 overflow-auto p-2 space-y-1.5 ${isVandaag ? 'bg-indigo-50/30' : 'bg-white'}`}>
                {dagDiensten.length === 0 ? (
                  <button onClick={() => onAddClick(iso)}
                    className="w-full h-8 rounded-lg border border-dashed border-slate-200 text-[10px] text-slate-300 hover:border-indigo-300 hover:text-indigo-400 transition">
                    + dienst
                  </button>
                ) : (
                  dagDiensten.map(dienst => (
                    <DienstBlok key={dienst.id} dienst={dienst} onClick={() => onDienstClick(dienst)} />
                  ))
                )}
                {dagDiensten.length > 0 && (
                  <button onClick={() => onAddClick(iso)}
                    className="w-full h-6 rounded-lg text-[10px] text-slate-300 hover:text-indigo-400 transition">+ toevoegen</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile lijst */}
      <div className="md:hidden space-y-3">
        {weekDagen.map(dag => {
          const iso = isoDate(dag);
          const isVandaag = iso === vandaag;
          const dagDiensten = (dienstenPerDag[iso] ?? []).sort((a,b) => a.start_tijd.localeCompare(b.start_tijd));
          const openCount = dagDiensten.filter(d => !d.team_member_id || d.status === 'open').length;
          return (
            <div key={iso} className={`rounded-2xl border overflow-hidden ${isVandaag ? 'border-indigo-300' : 'border-slate-100'}`}>
              <div className={`flex items-center justify-between px-4 py-3 ${isVandaag ? 'bg-indigo-600' : 'bg-white border-b border-slate-50'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold uppercase ${isVandaag ? 'text-indigo-200' : 'text-slate-400'}`}>{DAG_NAMEN[dag.getDay()]}</span>
                  <span className={`text-lg font-bold ${isVandaag ? 'text-white' : 'text-slate-800'}`}>{dag.getDate()} {MAAND_KORT[dag.getMonth()]}</span>
                  {openCount > 0 && <span className="text-[10px] font-bold bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full">{openCount} open</span>}
                </div>
                <button onClick={() => onAddClick(iso)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg transition ${isVandaag ? 'bg-indigo-500 text-white hover:bg-indigo-400' : 'text-indigo-600 hover:bg-indigo-50'}`}>
                  + dienst
                </button>
              </div>
              {dagDiensten.length > 0 && (
                <div className="bg-white divide-y divide-slate-50">
                  {dagDiensten.map(dienst => {
                    const isOpen = !dienst.team_member_id || dienst.status === 'open';
                    const stijl = isOpen ? STATUS_STIJL.open : (STATUS_STIJL[dienst.status] ?? STATUS_STIJL.open);
                    return (
                      <button key={dienst.id} onClick={() => onDienstClick(dienst)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${stijl.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">
                            {isOpen ? <span className="text-amber-600 font-semibold">Open dienst</span> : dienst.team_members?.naam}
                          </p>
                          <p className="text-xs text-slate-400">{dienst.start_tijd.slice(0,5)} – {dienst.eind_tijd.slice(0,5)}</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stijl.bg} ${stijl.text} ${stijl.border}`}>
                          {isOpen ? 'open' : dienst.status}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Maand View ────────────────────────────────────────────
function MaandView({
  maandDagen, maandStart, vandaag, dienstenPerDag, onDienstClick, onDagClick,
}: {
  maandDagen: Date[];
  maandStart: Date;
  vandaag: string;
  dienstenPerDag: Record<string, Dienst[]>;
  onDienstClick: (d: Dienst) => void;
  onDagClick: (iso: string) => void;
}) {
  const huidigeMaand = maandStart.getMonth();

  return (
    <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {/* Dag-headers ma-zo */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(d => (
          <div key={d} className="px-2 py-2.5 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Dagen grid */}
      <div className="flex-1 grid grid-cols-7" style={{ gridAutoRows: '1fr' }}>
        {maandDagen.map((dag, i) => {
          const iso = isoDate(dag);
          const isVandaag = iso === vandaag;
          const isHuidigeMaand = dag.getMonth() === huidigeMaand;
          const dagDiensten = (dienstenPerDag[iso] ?? []).sort((a,b) => a.start_tijd.localeCompare(b.start_tijd));
          const maxToon = 3;
          const extraCount = dagDiensten.length - maxToon;
          const isLaatsteRij = i >= maandDagen.length - 7;

          return (
            <div
              key={iso}
              className={`border-b border-r border-slate-50 p-1.5 cursor-pointer hover:bg-slate-50/50 transition ${
                isLaatsteRij ? 'border-b-0' : ''
              } ${i % 7 === 6 ? 'border-r-0' : ''}`}
              onClick={() => onDagClick(iso)}
            >
              {/* Dagnummer */}
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                  isVandaag
                    ? 'bg-indigo-600 text-white'
                    : isHuidigeMaand
                    ? 'text-slate-800'
                    : 'text-slate-300'
                }`}>
                  {dag.getDate()}
                </span>
              </div>

              {/* Diensten */}
              <div className="space-y-0.5">
                {dagDiensten.slice(0, maxToon).map(dienst => {
                  const isOpen = !dienst.team_member_id || dienst.status === 'open';
                  const stijl = isOpen ? STATUS_STIJL.open : (STATUS_STIJL[dienst.status] ?? STATUS_STIJL.open);
                  return (
                    <button
                      key={dienst.id}
                      onClick={e => { e.stopPropagation(); onDienstClick(dienst); }}
                      className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate ${stijl.bg} ${stijl.text} hover:opacity-80 transition`}
                    >
                      <span className="hidden md:inline">{dienst.start_tijd.slice(0,5)} </span>
                      {isOpen ? 'Open' : (dienst.team_members?.naam?.split(' ')[0] ?? '?')}
                    </button>
                  );
                })}
                {extraCount > 0 && (
                  <p className="text-[10px] text-slate-400 font-medium px-1">+{extraCount} meer</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DienstBlok({ dienst, onClick }: { dienst: Dienst; onClick: () => void }) {
  const isOpen = !dienst.team_member_id || dienst.status === 'open';
  const stijl = isOpen ? STATUS_STIJL.open : (STATUS_STIJL[dienst.status] ?? STATUS_STIJL.open);
  return (
    <button onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded-lg border text-[11px] font-medium transition hover:opacity-80 ${stijl.bg} ${stijl.text} ${stijl.border}`}>
      <div className="flex items-center gap-1">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${stijl.dot}`} />
        <span className="truncate">{isOpen ? 'Open dienst' : (dienst.team_members?.naam ?? '?')}</span>
      </div>
      <p className="opacity-70 mt-0.5 text-[10px]">{dienst.start_tijd.slice(0,5)}–{dienst.eind_tijd.slice(0,5)}</p>
    </button>
  );
}

