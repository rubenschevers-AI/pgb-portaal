'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type UrenEntry = {
  id: string;
  datum: string;
  start_tijd: string;
  eind_tijd: string;
  pauze_minuten: number | null;
  omschrijving: string | null;
  status: string;
  team_member_id: string;
  team_members: { naam: string; rol: string } | null;
};

type TeamLid = {
  id: string;
  naam: string;
  rol: string;
  uurtarief: number | null;
};

const STATUS_STIJL: Record<string, { bg: string; text: string; border: string; label: string }> = {
  ingediend:  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   label: 'Ingediend'  },
  goedgekeurd:{ bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Goedgekeurd'},
  afgewezen:  { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200',     label: 'Afgewezen'  },
  concept:    { bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200',   label: 'Concept'    },
};

function berekenUren(entry: { start_tijd: string; eind_tijd: string; pauze_minuten: number | null }): number {
  const start = new Date(`1970-01-01T${entry.start_tijd}`);
  const eind = new Date(`1970-01-01T${entry.eind_tijd}`);
  const minuten = (eind.getTime() - start.getTime()) / 60000 - (entry.pauze_minuten ?? 0);
  return Math.max(0, minuten / 60);
}

function formatDatum(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatEuro(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function UrenClient({
  uren: initUren,
  team,
  userId,
}: {
  uren: UrenEntry[];
  team: TeamLid[];
  userId: string;
}) {
  const supabase = createClient();
  const [uren, setUren] = useState<UrenEntry[]>(initUren);
  const [filter, setFilter] = useState<'ingediend' | 'alles'>('ingediend');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actieLoading, setActieLoading] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  // Form state
  const [formLid, setFormLid] = useState(team[0]?.id ?? '');
  const [formDatum, setFormDatum] = useState(() => new Date().toISOString().split('T')[0]);
  const [formStart, setFormStart] = useState('08:00');
  const [formEind, setFormEind] = useState('12:00');
  const [formPauze, setFormPauze] = useState('0');
  const [formOmschrijving, setFormOmschrijving] = useState('');

  const pendenteCount = uren.filter(u => u.status === 'ingediend').length;

  const gefilterd = filter === 'ingediend'
    ? uren.filter(u => u.status === 'ingediend')
    : uren;

  // ── Toevoegen ─────────────────────────────────────────────
  const handleToevoegen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLid) return;
    setLoading(true);
    setFout(null);

    const { data, error } = await supabase
      .from('uren_registratie')
      .insert({
        owner_id: userId,
        team_member_id: formLid,
        ingediend_door: userId,
        datum: formDatum,
        start_tijd: formStart,
        eind_tijd: formEind,
        pauze_minuten: parseInt(formPauze) || 0,
        omschrijving: formOmschrijving.trim() || null,
        status: 'goedgekeurd', // Direct goedkeuren als budgethouder voegt toe
      })
      .select('id, datum, start_tijd, eind_tijd, pauze_minuten, omschrijving, status, team_member_id, team_members(naam, rol)')
      .single();

    setLoading(false);
    if (error) { setFout(error.message); return; }
    if (data) setUren(prev => [data as UrenEntry, ...prev]);
    setShowForm(false);
    setFormOmschrijving('');
  };

  // ── Goedkeuren ────────────────────────────────────────────
  const handleGoedkeuren = async (id: string) => {
    setActieLoading(id);
    const { data } = await supabase
      .from('uren_registratie')
      .update({ status: 'goedgekeurd' })
      .eq('id', id)
      .select('id, datum, start_tijd, eind_tijd, pauze_minuten, omschrijving, status, team_member_id, team_members(naam, rol)')
      .single();
    if (data) setUren(prev => prev.map(u => u.id === id ? data as UrenEntry : u));
    setActieLoading(null);
  };

  // ── Afwijzen ──────────────────────────────────────────────
  const handleAfwijzen = async (id: string) => {
    setActieLoading(id);
    const { data } = await supabase
      .from('uren_registratie')
      .update({ status: 'afgewezen' })
      .eq('id', id)
      .select('id, datum, start_tijd, eind_tijd, pauze_minuten, omschrijving, status, team_member_id, team_members(naam, rol)')
      .single();
    if (data) setUren(prev => prev.map(u => u.id === id ? data as UrenEntry : u));
    setActieLoading(null);
  };

  // ── Totaal goedgekeurd ────────────────────────────────────
  const totaalUren = uren
    .filter(u => u.status === 'goedgekeurd')
    .reduce((sum, u) => sum + berekenUren(u), 0);

  const totaalBedrag = uren
    .filter(u => u.status === 'goedgekeurd')
    .reduce((sum, u) => {
      const tarief = team.find(t => t.id === u.team_member_id)?.uurtarief ?? 0;
      return sum + berekenUren(u) * tarief;
    }, 0);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Uren</h1>
          <p className="text-sm text-slate-400 mt-0.5">Registreer en keur uren goed</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition"
        >
          + Uren toevoegen
        </button>
      </div>

      {/* Samenvatting */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <p className="text-xs text-slate-400 font-medium mb-1">Te goedkeuren</p>
          <p className="text-2xl font-bold text-amber-600">{pendenteCount}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <p className="text-xs text-slate-400 font-medium mb-1">Goedgekeurde uren</p>
          <p className="text-2xl font-bold text-slate-900">{totaalUren.toFixed(1)}u</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 col-span-2 md:col-span-1">
          <p className="text-xs text-slate-400 font-medium mb-1">Totaal kosten</p>
          <p className="text-2xl font-bold text-emerald-700">{formatEuro(totaalBedrag)}</p>
        </div>
      </div>

      {/* Formulier */}
      {showForm && (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm mb-6">
          <h2 className="font-semibold text-slate-800 mb-4 text-sm">Uren registreren</h2>
          <form onSubmit={handleToevoegen} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Zorgverlener *</label>
                <select
                  value={formLid}
                  onChange={e => setFormLid(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Kies zorgverlener —</option>
                  {team.map(l => <option key={l.id} value={l.id}>{l.naam}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Datum *</label>
                <input
                  type="date"
                  value={formDatum}
                  onChange={e => setFormDatum(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Starttijd *</label>
                <input
                  type="time"
                  value={formStart}
                  onChange={e => setFormStart(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Eindtijd *</label>
                <input
                  type="time"
                  value={formEind}
                  onChange={e => setFormEind(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Pauze (minuten)</label>
                <input
                  type="number"
                  min="0"
                  value={formPauze}
                  onChange={e => setFormPauze(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Omschrijving</label>
                <input
                  type="text"
                  value={formOmschrijving}
                  onChange={e => setFormOmschrijving(e.target.value)}
                  placeholder="Optioneel..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            {fout && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{fout}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-sm transition">
                {loading ? 'Opslaan...' : 'Opslaan (goedgekeurd)'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition">
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex bg-slate-100 rounded-xl p-0.5 text-sm">
          <button
            onClick={() => setFilter('ingediend')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition text-sm ${
              filter === 'ingediend' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
            }`}
          >
            Te beoordelen
            {pendenteCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {pendenteCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilter('alles')}
            className={`px-3 py-1.5 rounded-xl font-medium transition text-sm ${
              filter === 'alles' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
            }`}
          >
            Alles
          </button>
        </div>
      </div>

      {/* Lijst */}
      {gefilterd.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center">
          <p className="text-slate-400 text-sm">
            {filter === 'ingediend' ? 'Geen uren te beoordelen.' : 'Nog geen uren geregistreerd.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
          <div className="divide-y divide-slate-50">
            {gefilterd.map(entry => {
              const uren = berekenUren(entry);
              const tarief = team.find(t => t.id === entry.team_member_id)?.uurtarief ?? 0;
              const bedrag = uren * tarief;
              const stijl = STATUS_STIJL[entry.status] ?? STATUS_STIJL.concept;
              const bezig = actieLoading === entry.id;

              return (
                <div key={entry.id} className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0">
                      {entry.team_members?.naam?.[0] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800">{entry.team_members?.naam ?? 'Onbekend'}</p>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${stijl.bg} ${stijl.text} ${stijl.border}`}>
                          {stijl.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDatum(entry.datum)} &middot; {entry.start_tijd.slice(0,5)}–{entry.eind_tijd.slice(0,5)}
                        {entry.pauze_minuten ? ` (${entry.pauze_minuten}min pauze)` : ''}
                      </p>
                      {entry.omschrijving && (
                        <p className="text-xs text-slate-400 mt-0.5 italic">{entry.omschrijving}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-900 tabular-nums">{uren.toFixed(2)}u</p>
                      {tarief > 0 && (
                        <p className="text-xs text-slate-400 tabular-nums">{formatEuro(bedrag)}</p>
                      )}
                    </div>
                  </div>

                  {/* Actie-knoppen voor ingediende uren */}
                  {entry.status === 'ingediend' && (
                    <div className="flex gap-2 mt-3 ml-14">
                      <button
                        onClick={() => handleGoedkeuren(entry.id)}
                        disabled={bezig}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {bezig ? 'Bezig...' : 'Goedkeuren'}
                      </button>
                      <button
                        onClick={() => handleAfwijzen(entry.id)}
                        disabled={bezig}
                        className="flex items-center gap-1.5 px-4 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 text-xs font-semibold rounded-xl transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Afwijzen
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
