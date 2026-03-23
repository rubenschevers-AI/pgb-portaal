'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type Afvinking = { id: string; datum: string; afgevinkt_door_naam?: string };

type Taak = {
  id: string;
  titel: string;
  omschrijving?: string;
  frequentie: string;
  status: string;
  prioriteit?: string;
  toegewezen_aan?: string;
  taken_afvinkingen?: Afvinking[];
};

type TeamLid = { id: string; naam: string };

const FREQUENTIES = ['dagelijks', 'wekelijks', 'maandelijks', 'eenmalig'];
const PRIORITEITEN = ['laag', 'normaal', 'hoog', 'urgent'];

const PRIORITEIT_STIJL: Record<string, { badge: string; dot: string }> = {
  urgent: { badge: 'bg-red-50 text-red-600 border-red-200',    dot: 'bg-red-500' },
  hoog:   { badge: 'bg-orange-50 text-orange-600 border-orange-200', dot: 'bg-orange-400' },
  normaal:{ badge: 'bg-blue-50 text-blue-600 border-blue-200',  dot: 'bg-blue-400' },
  laag:   { badge: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-300' },
};

export default function TakenClient({
  taken,
  team,
  userId,
  vandaag,
  isBeheerder = true,
}: {
  taken: Taak[];
  team: TeamLid[];
  userId: string;
  vandaag: string;
  isBeheerder?: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'actief' | 'alles'>('actief');
  const [afvinkenDoor, setAfvinkenDoor] = useState<{ taakId: string } | null>(null);
  const [geselecteerdLid, setGeselecteerdLid] = useState(team[0]?.id ?? '__zelf__');

  // Form state
  const [titel, setTitel] = useState('');
  const [omschrijving, setOmschrijving] = useState('');
  const [frequentie, setFrequentie] = useState('dagelijks');
  const [prioriteit, setPrioriteit] = useState('normaal');
  const [loading, setLoading] = useState(false);

  // Lokale afvinkingen state voor instant feedback
  const [afvinkingen, setAfvinkingen] = useState<Record<string, Afvinking[]>>(() => {
    const map: Record<string, Afvinking[]> = {};
    for (const t of taken) map[t.id] = t.taken_afvinkingen ?? [];
    return map;
  });

  const router = useRouter();
  const supabase = createClient();

  const isVandaagAfgevinkt = (taakId: string) =>
    (afvinkingen[taakId] ?? []).some(a => a.datum === vandaag);

  const afgevinkDoorVandaag = (taakId: string) =>
    (afvinkingen[taakId] ?? []).find(a => a.datum === vandaag)?.afgevinkt_door_naam;

  const handleAfvinkenKlik = (taak: Taak) => {
    if (isVandaagAfgevinkt(taak.id)) {
      // Direct ongedaan maken
      handleOngedaan(taak);
    } else {
      // Toon "wie heeft dit gedaan" modal
      setGeselecteerdLid(team[0]?.id ?? '__zelf__');
      setAfvinkenDoor({ taakId: taak.id });
    }
  };

  const handleAfvinkenBevestig = async () => {
    if (!afvinkenDoor) return;
    const taakId = afvinkenDoor.taakId;

    const lidNaam = geselecteerdLid === '__zelf__'
      ? 'Beheerder'
      : team.find(l => l.id === geselecteerdLid)?.naam ?? 'Teamlid';

    const tijdelijkId = `tmp-${Date.now()}`;
    setAfvinkingen(prev => ({
      ...prev,
      [taakId]: [...(prev[taakId] ?? []), { id: tijdelijkId, datum: vandaag, afgevinkt_door_naam: lidNaam }],
    }));
    setAfvinkenDoor(null);

    const { data } = await supabase
      .from('taken_afvinkingen')
      .insert({
        taak_id: taakId,
        datum: vandaag,
        afgevinkt_door: userId,
        afgevinkt_door_naam: lidNaam,
      })
      .select('id')
      .single();

    if (data) {
      setAfvinkingen(prev => ({
        ...prev,
        [taakId]: (prev[taakId] ?? []).map(a =>
          a.id === tijdelijkId ? { ...a, id: data.id } : a
        ),
      }));
    }
  };

  const handleOngedaan = async (taak: Taak) => {
    const afvinking = (afvinkingen[taak.id] ?? []).find(a => a.datum === vandaag);
    if (!afvinking) return;
    setAfvinkingen(prev => ({
      ...prev,
      [taak.id]: (prev[taak.id] ?? []).filter(a => a.id !== afvinking.id),
    }));
    await supabase.from('taken_afvinkingen').delete().eq('id', afvinking.id);
  };

  const handleToevoegen = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data } = await supabase.from('taken').insert({
      titel,
      omschrijving: omschrijving || null,
      frequentie,
      prioriteit,
      status: 'actief',
      owner_id: userId,
    }).select('id').single();
    if (data) {
      setAfvinkingen(prev => ({ ...prev, [data.id]: [] }));
    }
    setTitel(''); setOmschrijving(''); setFrequentie('dagelijks'); setPrioriteit('normaal');
    setShowForm(false);
    setLoading(false);
    router.refresh();
  };

  const handleStatusToggle = async (taak: Taak) => {
    const nieuw = taak.status === 'actief' ? 'inactief' : 'actief';
    await supabase.from('taken').update({ status: nieuw }).eq('id', taak.id);
    router.refresh();
  };

  const handleVerwijder = async (id: string) => {
    if (!confirm('Taak verwijderen?')) return;
    await supabase.from('taken').delete().eq('id', id);
    router.refresh();
  };

  const gefilterd = filter === 'actief' ? taken.filter(t => t.status === 'actief') : taken;
  const prioriteitVolgorde = ['urgent', 'hoog', 'normaal', 'laag'];
  const perPrioriteit = gefilterd.reduce<Record<string, Taak[]>>((acc, t) => {
    const p = t.prioriteit ?? 'normaal';
    if (!acc[p]) acc[p] = [];
    acc[p].push(t);
    return acc;
  }, {});

  const aantalActief = taken.filter(t => t.status === 'actief').length;
  const aantalVandaag = taken.filter(t => t.status === 'actief' && isVandaagAfgevinkt(t.id)).length;
  const progressPct = aantalActief > 0 ? Math.round((aantalVandaag / aantalActief) * 100) : 0;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Taken</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {aantalVandaag} van {aantalActief} gedaan vandaag
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-xl p-0.5 text-sm">
            <button
              onClick={() => setFilter('actief')}
              className={`px-3 py-1.5 rounded-xl font-medium transition text-sm ${filter === 'actief' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
            >
              Actief
            </button>
            <button
              onClick={() => setFilter('alles')}
              className={`px-3 py-1.5 rounded-xl font-medium transition text-sm ${filter === 'alles' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
            >
              Alles
            </button>
          </div>
          {isBeheerder && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition"
            >
              + Taak
            </button>
          )}
        </div>
      </div>

      {/* Voortgangsbalk */}
      {aantalActief > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-600">Voortgang vandaag</p>
            <p className="text-xs font-bold text-indigo-600">{progressPct}%</p>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Formulier */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-5">
          <h2 className="font-semibold text-slate-800 mb-4 text-sm">Nieuwe taak</h2>
          <form onSubmit={handleToevoegen} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Titel *</label>
              <input
                type="text"
                value={titel}
                onChange={e => setTitel(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="bijv. Ochtendverzorging"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Omschrijving</label>
              <textarea
                value={omschrijving}
                onChange={e => setOmschrijving(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Optionele toelichting..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Frequentie</label>
                <select
                  value={frequentie}
                  onChange={e => setFrequentie(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {FREQUENTIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Prioriteit</label>
                <select
                  value={prioriteit}
                  onChange={e => setPrioriteit(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PRIORITEITEN.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-sm transition">
                {loading ? 'Opslaan...' : 'Toevoegen'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition">
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Taken lijst */}
      {gefilterd.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-slate-400">Nog geen taken. Voeg je eerste taak toe.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {prioriteitVolgorde.filter(p => perPrioriteit[p]?.length).map(p => {
            const stijl = PRIORITEIT_STIJL[p] ?? PRIORITEIT_STIJL.normaal;
            return (
              <div key={p} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${stijl.dot}`} />
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${stijl.badge}`}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {perPrioriteit[p].filter(t => isVandaagAfgevinkt(t.id)).length}/{perPrioriteit[p].filter(t => t.status === 'actief').length} gedaan
                  </span>
                </div>
                <div className="divide-y divide-slate-50">
                  {perPrioriteit[p].map(taak => {
                    const gedaan = isVandaagAfgevinkt(taak.id);
                    const door = afgevinkDoorVandaag(taak.id);
                    const isActief = taak.status === 'actief';
                    return (
                      <div key={taak.id} className={`flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition ${!isActief ? 'opacity-40' : ''}`}>
                        {/* Checkbox */}
                        {isActief ? (
                          <button
                            onClick={() => handleAfvinkenKlik(taak)}
                            className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              gedaan
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50'
                            }`}
                            title={gedaan ? 'Markeer als niet gedaan' : 'Markeer als gedaan'}
                          >
                            {gedaan && (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                              </svg>
                            )}
                          </button>
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-slate-200 shrink-0" />
                        )}

                        {/* Inhoud */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${gedaan ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                            {taak.titel}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-slate-400">{taak.frequentie}</span>
                            {gedaan && door && (
                              <span className="text-xs text-emerald-600 font-medium">✓ {door}</span>
                            )}
                            {taak.omschrijving && (
                              <span className="text-xs text-slate-300 truncate max-w-xs hidden lg:inline">{taak.omschrijving}</span>
                            )}
                          </div>
                        </div>

                        {/* Acties — alleen voor beheerder */}
                        {isBeheerder && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleStatusToggle(taak)}
                              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition"
                            >
                              {taak.status === 'actief' ? 'Pauzeer' : 'Activeer'}
                            </button>
                            <button
                              onClick={() => handleVerwijder(taak.id)}
                              className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Wie heeft dit gedaan? modal ── */}
      {afvinkenDoor && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setAfvinkenDoor(null)} />
          <div className="relative z-50 bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-w-sm mx-0 md:mx-4 p-6">
            <h2 className="font-bold text-slate-900 mb-1">Wie heeft dit gedaan?</h2>
            <p className="text-sm text-slate-400 mb-4">
              {taken.find(t => t.id === afvinkenDoor.taakId)?.titel}
            </p>
            <div className="space-y-2 mb-5">
              <button
                onClick={() => setGeselecteerdLid('__zelf__')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition ${
                  geselecteerdLid === '__zelf__' ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">B</div>
                Beheerder (ikzelf)
              </button>
              {team.map(lid => (
                <button
                  key={lid.id}
                  onClick={() => setGeselecteerdLid(lid.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition ${
                    geselecteerdLid === lid.id ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
                    {lid.naam[0]}
                  </div>
                  {lid.naam}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAfvinkenBevestig}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition"
              >
                Bevestigen
              </button>
              <button
                onClick={() => setAfvinkenDoor(null)}
                className="px-4 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
