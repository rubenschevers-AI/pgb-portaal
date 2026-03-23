'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type Budget = {
  id: string;
  owner_id: string;
  naam: string;
  totaal_budget: number;
  periode_start: string;
  periode_eind: string;
};

type TeamLid = {
  id: string;
  naam: string;
  rol: string;
  uurtarief: number | null;
  status: string;
};

type UrenEntry = {
  id: string;
  datum: string;
  start_tijd: string;
  eind_tijd: string;
  pauze_minuten: number | null;
  team_member_id: string;
  team_members: { naam: string; uurtarief: number | null } | null;
};

type Props = {
  budget: Budget | null;
  teamleden: TeamLid[];
  recentUren: UrenEntry[];
  totaalVerbruikt: number;
  userId: string;
};

function berekenUren(entry: UrenEntry): number {
  const start = new Date(`1970-01-01T${entry.start_tijd}`);
  const eind = new Date(`1970-01-01T${entry.eind_tijd}`);
  const minuten = (eind.getTime() - start.getTime()) / 60000 - (entry.pauze_minuten ?? 0);
  return Math.max(0, minuten / 60);
}

function formatEuro(bedrag: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(bedrag);
}

function formatDatum(datum: string): string {
  return new Date(datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function BudgetClient({ budget, teamleden, recentUren, totaalVerbruikt, userId }: Props) {
  const router = useRouter();
  const supabase = createClient();

  // Budget instellen form state
  const [formNaam, setFormNaam] = useState('');
  const [formTotaal, setFormTotaal] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEind, setFormEind] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Uurtarief bewerken state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTarief, setEditTarief] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleBudgetAanmaken = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formNaam || !formTotaal || !formStart || !formEind) {
      setFormError('Vul alle velden in.');
      return;
    }
    const totaal = parseFloat(formTotaal.replace(',', '.'));
    if (isNaN(totaal) || totaal <= 0) {
      setFormError('Voer een geldig bedrag in.');
      return;
    }
    setFormLoading(true);
    const { error } = await supabase.from('budget').insert({
      owner_id: userId,
      naam: formNaam,
      totaal_budget: totaal,
      periode_start: formStart,
      periode_eind: formEind,
    });
    setFormLoading(false);
    if (error) {
      setFormError(error.message);
    } else {
      router.refresh();
    }
  };

  const startEdit = (lid: TeamLid) => {
    setEditingId(lid.id);
    setEditTarief(lid.uurtarief != null ? String(lid.uurtarief) : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTarief('');
  };

  const saveTarief = async (lidId: string) => {
    const tarief = parseFloat(editTarief.replace(',', '.'));
    if (isNaN(tarief) || tarief < 0) return;
    setSavingId(lidId);
    await supabase
      .from('team_members')
      .update({ uurtarief: tarief })
      .eq('id', lidId)
      .eq('owner_id', userId);
    setSavingId(null);
    setEditingId(null);
    router.refresh();
  };

  const resterend = budget ? budget.totaal_budget - totaalVerbruikt : 0;
  const verbruiktPct = budget && budget.totaal_budget > 0 ? Math.min(100, (totaalVerbruikt / budget.totaal_budget) * 100) : 0;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Budget</h1>
        <p className="text-sm text-slate-400 mt-1">Beheer uw PGB-budget en uurtarieven</p>
      </div>

      {/* Budget instellen (geen budget aanwezig) */}
      {!budget && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-slate-800 text-sm mb-1">Budget instellen</h2>
          <p className="text-xs text-slate-400 mb-5">U heeft nog geen budget aangemaakt. Stel uw PGB-budget in om te beginnen.</p>
          <form onSubmit={handleBudgetAanmaken} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Naam</label>
                <input
                  type="text"
                  value={formNaam}
                  onChange={e => setFormNaam(e.target.value)}
                  placeholder="bijv. PGB Budget 2025"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Totaalbudget (euro)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formTotaal}
                  onChange={e => setFormTotaal(e.target.value)}
                  placeholder="bijv. 50000"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Periode start</label>
                <input
                  type="date"
                  value={formStart}
                  onChange={e => setFormStart(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Periode eind</label>
                <input
                  type="date"
                  value={formEind}
                  onChange={e => setFormEind(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            {formError && (
              <p className="text-xs text-red-500 font-medium">{formError}</p>
            )}
            <button
              type="submit"
              disabled={formLoading}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              {formLoading ? (
                <>
                  <SpinnerIcon />
                  Opslaan...
                </>
              ) : (
                'Budget aanmaken'
              )}
            </button>
          </form>
        </div>
      )}

      {/* Budget overzicht */}
      {budget && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-semibold text-slate-800 text-base">{budget.naam}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {formatDatum(budget.periode_start)} t/m {formatDatum(budget.periode_eind)}
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full">
              Actief
            </span>
          </div>

          {/* Drie kolommen */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-400 font-medium mb-1">Totaalbudget</p>
              <p className="text-xl font-bold text-slate-900">{formatEuro(budget.totaal_budget)}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4">
              <p className="text-xs text-amber-600 font-medium mb-1">Verbruikt</p>
              <p className="text-xl font-bold text-amber-700">{formatEuro(totaalVerbruikt)}</p>
            </div>
            <div className={`rounded-xl p-4 ${resterend < 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
              <p className={`text-xs font-medium mb-1 ${resterend < 0 ? 'text-red-500' : 'text-emerald-600'}`}>Resterend</p>
              <p className={`text-xl font-bold ${resterend < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatEuro(resterend)}</p>
            </div>
          </div>

          {/* Progressbar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-slate-500 font-medium">Verbruikt</p>
              <p className="text-xs text-slate-500 font-medium">{verbruiktPct.toFixed(1)}%</p>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  verbruiktPct >= 90 ? 'bg-red-500' : verbruiktPct >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${verbruiktPct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Uurtarieven per zorgverlener */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-800 text-sm">Uurtarieven</h2>
          <p className="text-xs text-slate-400 mt-0.5">Beheer de uurtarieven van uw zorgverleners</p>
        </div>
        {teamleden.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-slate-400">Geen actieve zorgverleners gevonden</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {teamleden.map(lid => (
              <div key={lid.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0">
                  {lid.naam[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{lid.naam}</p>
                  <p className="text-xs text-slate-400 truncate">{lid.rol}</p>
                </div>
                {editingId === lid.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editTarief}
                        onChange={e => setEditTarief(e.target.value)}
                        className="w-24 pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveTarief(lid.id);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                    </div>
                    <button
                      onClick={() => saveTarief(lid.id)}
                      disabled={savingId === lid.id}
                      className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {savingId === lid.id ? 'Opslaan...' : 'Opslaan'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg transition-colors"
                    >
                      Annuleren
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-slate-700">
                      {lid.uurtarief != null ? formatEuro(lid.uurtarief) + '/u' : <span className="text-slate-300 font-normal">Niet ingesteld</span>}
                    </span>
                    <button
                      onClick={() => startEdit(lid)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Bewerken
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent verbruik */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-800 text-sm">Recent verbruik</h2>
          <p className="text-xs text-slate-400 mt-0.5">Laatste 10 goedgekeurde uren</p>
        </div>
        {recentUren.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-slate-400">Nog geen goedgekeurde uren geregistreerd</p>
          </div>
        ) : (
          <>
            {/* Desktop tabel */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="text-left text-xs font-semibold text-slate-400 px-5 py-3">Datum</th>
                    <th className="text-left text-xs font-semibold text-slate-400 px-5 py-3">Zorgverlener</th>
                    <th className="text-right text-xs font-semibold text-slate-400 px-5 py-3">Uren</th>
                    <th className="text-right text-xs font-semibold text-slate-400 px-5 py-3">Uurtarief</th>
                    <th className="text-right text-xs font-semibold text-slate-400 px-5 py-3">Bedrag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentUren.map(entry => {
                    const uren = berekenUren(entry);
                    const tarief = entry.team_members?.uurtarief ?? 0;
                    const bedrag = uren * tarief;
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">{formatDatum(entry.datum)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                              {entry.team_members?.naam?.[0] ?? '?'}
                            </div>
                            <span className="text-slate-800 font-medium truncate max-w-[140px]">
                              {entry.team_members?.naam ?? 'Onbekend'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-600 tabular-nums">{uren.toFixed(2)}</td>
                        <td className="px-5 py-3.5 text-right text-slate-600 tabular-nums">{formatEuro(tarief)}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-slate-800 tabular-nums">{formatEuro(bedrag)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile kaartjes */}
            <div className="sm:hidden divide-y divide-slate-50">
              {recentUren.map(entry => {
                const uren = berekenUren(entry);
                const tarief = entry.team_members?.uurtarief ?? 0;
                const bedrag = uren * tarief;
                return (
                  <div key={entry.id} className="px-5 py-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 shrink-0">
                      {entry.team_members?.naam?.[0] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{entry.team_members?.naam ?? 'Onbekend'}</p>
                      <p className="text-xs text-slate-400">{formatDatum(entry.datum)} &middot; {uren.toFixed(2)}u &times; {formatEuro(tarief)}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 tabular-nums shrink-0">{formatEuro(bedrag)}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
