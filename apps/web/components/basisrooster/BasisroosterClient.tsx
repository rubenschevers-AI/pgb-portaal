'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type RoosterSlot = {
  id: string;
  dag_van_week: number;
  start_tijd: string;
  eind_tijd: string;
  team_member_id: string | null;
  notities: string;
  geldig_van: string;
  geldig_tot: string;
  team_members?: { id: string; naam: string; rol: string } | null;
};

type Beschikbaarheid = {
  id: string;
  team_member_id: string;
  dag_van_week: number;
  start_tijd: string;
  eind_tijd: string;
  notities: string;
};

type Afwijking = {
  id: string;
  team_member_id: string;
  datum: string;
  is_beschikbaar: boolean;
  start_tijd: string | null;
  eind_tijd: string | null;
  reden: string;
};

type TeamLid = { id: string; naam: string; rol: string; uurtarief: number; status: string };

const DAGEN = ['', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
const DAGEN_KORT = ['', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

export default function BasisroosterClient({
  userId,
  roosterSlots: initSlots,
  team,
  beschikbaarheid: initBeschikbaarheid,
  afwijkingen: initAfwijkingen,
}: {
  userId: string;
  roosterSlots: RoosterSlot[];
  team: TeamLid[];
  beschikbaarheid: Beschikbaarheid[];
  afwijkingen: Afwijking[];
}) {
  const [tab, setTab] = useState<'zorgbehoefte' | 'beschikbaarheid'>('zorgbehoefte');
  const [slots, setSlots] = useState<RoosterSlot[]>(initSlots);
  const [beschikbaarheid, setBeschikbaarheid] = useState<Beschikbaarheid[]>(initBeschikbaarheid);
  const [afwijkingen, setAfwijkingen] = useState<Afwijking[]>(initAfwijkingen);
  const [selectedLidId, setSelectedLidId] = useState<string>(team[0]?.id ?? '');

  // Formulier zorgbehoefte
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotDag, setSlotDag] = useState(1);
  const [slotStart, setSlotStart] = useState('08:00');
  const [slotEind, setSlotEind] = useState('12:00');
  const [slotLid, setSlotLid] = useState('');
  const [slotNotities, setSlotNotities] = useState('');
  const [slotLoading, setSlotLoading] = useState(false);

  // Formulier beschikbaarheid
  const [showBeschForm, setShowBeschForm] = useState(false);
  const [beschDag, setBeschDag] = useState(1);
  const [beschStart, setBeschStart] = useState('07:00');
  const [beschEind, setBeschEind] = useState('18:00');
  const [beschLoading, setBeschLoading] = useState(false);

  // Formulier afwijking
  const [showAfwijkForm, setShowAfwijkForm] = useState(false);
  const [afwijkDatum, setAfwijkDatum] = useState('');
  const [afwijkBeschikbaar, setAfwijkBeschikbaar] = useState(true);
  const [afwijkStart, setAfwijkStart] = useState('07:00');
  const [afwijkEind, setAfwijkEind] = useState('18:00');
  const [afwijkReden, setAfwijkReden] = useState('');
  const [afwijkLoading, setAfwijkLoading] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // ── Zorgbehoefte handlers ──────────────────────────────────
  const handleSlotToevoegen = async (e: React.FormEvent) => {
    e.preventDefault();
    setSlotLoading(true);
    const vandaag = new Date().toISOString().split('T')[0];
    const overJaar = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await supabase.from('basisrooster').insert({
      owner_id: userId,
      dag_van_week: slotDag,
      start_tijd: slotStart,
      eind_tijd: slotEind,
      team_member_id: slotLid || null,
      notities: slotNotities,
      geldig_van: vandaag,
      geldig_tot: overJaar,
    }).select('*, team_members(id, naam, rol)').single();

    if (!error && data) {
      setSlots(prev => [...prev, data as RoosterSlot].sort((a, b) =>
        a.dag_van_week - b.dag_van_week || a.start_tijd.localeCompare(b.start_tijd)
      ));
    }
    setSlotNotities(''); setSlotLid('');
    setShowSlotForm(false);
    setSlotLoading(false);
  };

  const handleSlotVerwijder = async (id: string) => {
    setSlots(prev => prev.filter(s => s.id !== id));
    await supabase.from('basisrooster').delete().eq('id', id);
  };

  // ── Beschikbaarheid handlers ───────────────────────────────
  const handleBeschToevoegen = async (e: React.FormEvent) => {
    e.preventDefault();
    setBeschLoading(true);
    const { data, error } = await supabase.from('team_beschikbaarheid').insert({
      owner_id: userId,
      team_member_id: selectedLidId,
      dag_van_week: beschDag,
      start_tijd: beschStart,
      eind_tijd: beschEind,
    }).select().single();

    if (!error && data) {
      setBeschikbaarheid(prev => [...prev, data as Beschikbaarheid]);
    }
    setShowBeschForm(false);
    setBeschLoading(false);
  };

  const handleBeschVerwijder = async (id: string) => {
    setBeschikbaarheid(prev => prev.filter(b => b.id !== id));
    await supabase.from('team_beschikbaarheid').delete().eq('id', id);
  };

  // ── Afwijking handlers ─────────────────────────────────────
  const handleAfwijkToevoegen = async (e: React.FormEvent) => {
    e.preventDefault();
    setAfwijkLoading(true);
    const { data, error } = await supabase.from('team_beschikbaarheid_afwijking').upsert({
      owner_id: userId,
      team_member_id: selectedLidId,
      datum: afwijkDatum,
      is_beschikbaar: afwijkBeschikbaar,
      start_tijd: afwijkBeschikbaar ? afwijkStart : null,
      eind_tijd: afwijkBeschikbaar ? afwijkEind : null,
      reden: afwijkReden,
    }, { onConflict: 'team_member_id,datum' }).select().single();

    if (!error && data) {
      setAfwijkingen(prev => {
        const filtered = prev.filter(a => !(a.team_member_id === selectedLidId && a.datum === afwijkDatum));
        return [...filtered, data as Afwijking].sort((a, b) => a.datum.localeCompare(b.datum));
      });
    }
    setAfwijkReden(''); setAfwijkDatum('');
    setShowAfwijkForm(false);
    setAfwijkLoading(false);
  };

  const handleAfwijkVerwijder = async (id: string) => {
    setAfwijkingen(prev => prev.filter(a => a.id !== id));
    await supabase.from('team_beschikbaarheid_afwijking').delete().eq('id', id);
  };

  const slotsPerDag = (dag: number) => slots.filter(s => s.dag_van_week === dag);
  const beschPerDag = (dag: number, lidId: string) =>
    beschikbaarheid.filter(b => b.dag_van_week === dag && b.team_member_id === lidId);
  const afwijkingenVoorLid = (lidId: string) =>
    afwijkingen.filter(a => a.team_member_id === lidId);
  const geselecteerdLid = team.find(l => l.id === selectedLidId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-8 py-4 bg-white border-b border-slate-100 gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Basisrooster</h1>
          <p className="text-xs text-slate-400 mt-0.5">Wekelijks terugkerend zorgschema</p>
        </div>
        {/* Tabs */}
        <div className="flex bg-slate-100 rounded-xl p-0.5 text-sm">
          <button
            onClick={() => setTab('zorgbehoefte')}
            className={`px-3 py-1.5 rounded-xl font-medium transition ${tab === 'zorgbehoefte' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
          >
            Mijn zorgbehoefte
          </button>
          <button
            onClick={() => setTab('beschikbaarheid')}
            className={`px-3 py-1.5 rounded-xl font-medium transition ${tab === 'beschikbaarheid' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
          >
            Team beschikbaarheid
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex flex-col px-4 md:px-8 py-6 max-w-7xl mx-auto w-full">

        {/* ── TAB 1: Zorgbehoefte ─────────────────────────────── */}
        {tab === 'zorgbehoefte' && (
          <div className="flex flex-col flex-1">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-slate-500">
                Geef per dag aan wanneer je zorg wilt ontvangen en van wie. Dit is de basis voor je weekplanning.
              </p>
              <button
                onClick={() => setShowSlotForm(!showSlotForm)}
                className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition ml-4"
              >
                + Tijdslot
              </button>
            </div>

            {showSlotForm && (
              <form onSubmit={handleSlotToevoegen} className="bg-white rounded-2xl border border-slate-100 p-5 mb-5">
                <h3 className="font-semibold text-slate-800 mb-4 text-sm">Nieuw tijdslot</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Dag *</label>
                    <select
                      value={slotDag}
                      onChange={e => setSlotDag(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {[1,2,3,4,5,6,7].map(d => (
                        <option key={d} value={d}>{DAGEN[d]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Van *</label>
                    <input type="time" value={slotStart} onChange={e => setSlotStart(e.target.value)} required
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Tot *</label>
                    <input type="time" value={slotEind} onChange={e => setSlotEind(e.target.value)} required
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Voorkeur zorgverlener</label>
                    <select
                      value={slotLid}
                      onChange={e => setSlotLid(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">— Open (iedereen) —</option>
                      {team.map(l => <option key={l.id} value={l.id}>{l.naam}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2 md:col-span-4">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Notitie</label>
                    <input type="text" value={slotNotities} onChange={e => setSlotNotities(e.target.value)} placeholder="bijv. ochtendverzorging, medicatie innemen..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button type="submit" disabled={slotLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-sm transition">
                    {slotLoading ? 'Opslaan...' : 'Toevoegen'}
                  </button>
                  <button type="button" onClick={() => setShowSlotForm(false)}
                    className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition">Annuleren</button>
                </div>
              </form>
            )}

            {/* Week overzicht */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-7 gap-2" style={{ gridAutoRows: '1fr' }}>
              {[1,2,3,4,5,6,7].map(dag => {
                const dagSlots = slotsPerDag(dag);
                return (
                  <div key={dag} className="flex flex-col bg-white rounded-2xl border border-slate-100 overflow-hidden">
                    <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 hidden md:block">{DAGEN_KORT[dag]}</p>
                        <p className="text-sm font-bold text-slate-700 md:hidden">{DAGEN[dag]}</p>
                        <p className="text-xl font-bold text-slate-800 hidden md:block leading-none">{DAGEN_KORT[dag]}</p>
                      </div>
                      <button
                        onClick={() => { setSlotDag(dag); setShowSlotForm(true); }}
                        className="text-indigo-500 hover:text-indigo-700 text-lg leading-none md:text-sm"
                        title="Tijdslot toevoegen"
                      >+</button>
                    </div>
                    <div className="flex-1 overflow-auto p-2 space-y-1.5">
                      {dagSlots.length === 0 ? (
                        <p className="text-[10px] text-slate-300 text-center py-3">Geen zorg</p>
                      ) : (
                        dagSlots.map(slot => (
                          <div key={slot.id} className={`group relative px-2 py-1.5 rounded-xl text-xs border ${
                            slot.team_member_id
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                              : 'bg-amber-50 border-amber-200 text-amber-700'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{slot.start_tijd.slice(0,5)}–{slot.eind_tijd.slice(0,5)}</span>
                              <button
                                onClick={() => handleSlotVerwijder(slot.id)}
                                className="opacity-0 group-hover:opacity-100 text-current hover:opacity-80 transition ml-1"
                              >×</button>
                            </div>
                            <p className="opacity-70 mt-0.5 truncate">
                              {slot.team_members?.naam ?? '● Open dienst'}
                            </p>
                            {slot.notities && <p className="opacity-50 truncate text-[10px]">{slot.notities}</p>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {slots.length === 0 && (
              <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-amber-700">
                <strong>Geen tijdsloten ingesteld.</strong> Voeg tijdsloten toe om je wekelijkse zorgbehoefte vast te leggen. Vanuit het basisrooster kun je de planning van een week automatisch vullen.
              </div>
            )}

            {slots.length > 0 && (
              <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-indigo-800">Basisrooster toepassen op een week</p>
                  <p className="text-xs text-indigo-600 mt-0.5">Genereer de planning automatisch op basis van dit rooster.</p>
                </div>
                <a href="/planning" className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition">
                  Naar planning →
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Beschikbaarheid team ──────────────────────── */}
        {tab === 'beschikbaarheid' && (
          <div>
            {team.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-400">
                Voeg eerst teamleden toe via de <a href="/team" className="text-indigo-600 font-medium">Team-pagina</a>.
              </div>
            ) : (
              <div className="flex gap-5 flex-col md:flex-row">
                {/* Teamleden lijst */}
                <div className="md:w-48 shrink-0 space-y-1">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Zorgverlener</p>
                  {team.map(lid => (
                    <button
                      key={lid.id}
                      onClick={() => setSelectedLidId(lid.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left ${
                        selectedLidId === lid.id
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        selectedLidId === lid.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {lid.naam[0]}
                      </div>
                      <span className="truncate">{lid.naam}</span>
                    </button>
                  ))}
                </div>

                {/* Beschikbaarheid detail */}
                {geselecteerdLid && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                      <div>
                        <h2 className="font-bold text-slate-900">{geselecteerdLid.naam}</h2>
                        <p className="text-xs text-slate-400 capitalize">{geselecteerdLid.rol}</p>
                      </div>
                    </div>

                    {/* Basisrooster per dag */}
                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-4">
                      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
                        <h3 className="font-semibold text-slate-800 text-sm">Standaard beschikbaarheid</h3>
                        <button
                          onClick={() => setShowBeschForm(!showBeschForm)}
                          className="text-xs text-indigo-600 font-medium hover:text-indigo-700"
                        >+ Dag toevoegen</button>
                      </div>

                      {showBeschForm && (
                        <form onSubmit={handleBeschToevoegen} className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Dag</label>
                              <select value={beschDag} onChange={e => setBeschDag(Number(e.target.value))}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                {[1,2,3,4,5,6,7].map(d => <option key={d} value={d}>{DAGEN[d]}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Van</label>
                              <input type="time" value={beschStart} onChange={e => setBeschStart(e.target.value)} required
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Tot</label>
                              <input type="time" value={beschEind} onChange={e => setBeschEind(e.target.value)} required
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button type="submit" disabled={beschLoading}
                              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-xl text-sm transition">
                              {beschLoading ? 'Opslaan...' : 'Toevoegen'}
                            </button>
                            <button type="button" onClick={() => setShowBeschForm(false)}
                              className="px-3 py-1.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100 transition">Annuleren</button>
                          </div>
                        </form>
                      )}

                      <div className="divide-y divide-slate-50">
                        {[1,2,3,4,5,6,7].map(dag => {
                          const dagBeschikbaarheid = beschPerDag(dag, selectedLidId);
                          if (dagBeschikbaarheid.length === 0) return null;
                          return dagBeschikbaarheid.map(b => (
                            <div key={b.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition">
                              <div className="w-20 shrink-0">
                                <span className="text-xs font-semibold text-slate-600">{DAGEN[dag]}</span>
                              </div>
                              <div className="flex-1">
                                <span className="text-sm text-slate-700">{b.start_tijd.slice(0,5)} – {b.eind_tijd.slice(0,5)}</span>
                              </div>
                              <button onClick={() => handleBeschVerwijder(b.id)}
                                className="text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded-lg hover:bg-red-50 transition">×</button>
                            </div>
                          ));
                        })}
                        {beschikbaarheid.filter(b => b.team_member_id === selectedLidId).length === 0 && (
                          <div className="px-5 py-8 text-center text-sm text-slate-400">
                            Nog geen standaard beschikbaarheid ingesteld.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Afwijkingen */}
                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
                        <h3 className="font-semibold text-slate-800 text-sm">Afwijkingen (komende weken)</h3>
                        <button
                          onClick={() => setShowAfwijkForm(!showAfwijkForm)}
                          className="text-xs text-indigo-600 font-medium hover:text-indigo-700"
                        >+ Afwijking</button>
                      </div>

                      {showAfwijkForm && (
                        <form onSubmit={handleAfwijkToevoegen} className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Datum *</label>
                              <input type="date" value={afwijkDatum} onChange={e => setAfwijkDatum(e.target.value)} required
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Beschikbaar?</label>
                              <select value={afwijkBeschikbaar ? 'ja' : 'nee'} onChange={e => setAfwijkBeschikbaar(e.target.value === 'ja')}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="ja">Ja (andere tijden)</option>
                                <option value="nee">Nee (niet beschikbaar)</option>
                              </select>
                            </div>
                            {afwijkBeschikbaar && <>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Van</label>
                                <input type="time" value={afwijkStart} onChange={e => setAfwijkStart(e.target.value)}
                                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Tot</label>
                                <input type="time" value={afwijkEind} onChange={e => setAfwijkEind(e.target.value)}
                                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                              </div>
                            </>}
                            <div className="col-span-2 md:col-span-4">
                              <label className="block text-xs font-medium text-slate-600 mb-1">Reden (optioneel)</label>
                              <input type="text" value={afwijkReden} onChange={e => setAfwijkReden(e.target.value)}
                                placeholder="bijv. vakantie, ziek, andere afspraak..."
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button type="submit" disabled={afwijkLoading}
                              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-xl text-sm transition">
                              {afwijkLoading ? 'Opslaan...' : 'Opslaan'}
                            </button>
                            <button type="button" onClick={() => setShowAfwijkForm(false)}
                              className="px-3 py-1.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100 transition">Annuleren</button>
                          </div>
                        </form>
                      )}

                      <div className="divide-y divide-slate-50">
                        {afwijkingenVoorLid(selectedLidId).length === 0 ? (
                          <div className="px-5 py-8 text-center text-sm text-slate-400">
                            Geen geplande afwijkingen.
                          </div>
                        ) : (
                          afwijkingenVoorLid(selectedLidId).map(a => (
                            <div key={a.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${a.is_beschikbaar ? 'bg-emerald-400' : 'bg-red-400'}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800">
                                  {new Date(a.datum + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {a.is_beschikbaar
                                    ? `${a.start_tijd?.slice(0,5)} – ${a.eind_tijd?.slice(0,5)}`
                                    : 'Niet beschikbaar'}
                                  {a.reden && ` · ${a.reden}`}
                                </p>
                              </div>
                              <button onClick={() => handleAfwijkVerwijder(a.id)}
                                className="text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded-lg hover:bg-red-50 transition">×</button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
