'use client';

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

type Meting = {
  id: string;
  type: string;
  waarde: string;
  eenheid: string;
  datum: string;
  tijdstip: string | null;
  notities: string | null;
  gemeten_door_naam: string | null;
  created_at: string;
};

const MEETTYPEN = [
  { type: 'bloeddruk',   label: 'Bloeddruk',   eenheid: 'mmHg',   placeholder: '120/80' },
  { type: 'temperatuur', label: 'Temperatuur',  eenheid: '°C',     placeholder: '37.0' },
  { type: 'gewicht',     label: 'Gewicht',      eenheid: 'kg',     placeholder: '70.0' },
  { type: 'glucose',     label: 'Glucose',      eenheid: 'mmol/L', placeholder: '5.5' },
  { type: 'saturatie',   label: 'Saturatie',    eenheid: '%',      placeholder: '98' },
  { type: 'pols',        label: 'Pols',         eenheid: 'bpm',    placeholder: '72' },
];

function getNow() {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().slice(0, 5);
  return { date, time };
}

function formatDatum(datum: string) {
  const d = new Date(datum);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTijdstip(tijdstip: string | null) {
  if (!tijdstip) return '';
  return tijdstip.slice(0, 5);
}

function parseWaardeNumeriek(waarde: string): number | null {
  if (waarde.includes('/')) {
    const parts = waarde.split('/');
    const systolisch = parseFloat(parts[0]);
    return isNaN(systolisch) ? null : systolisch;
  }
  const n = parseFloat(waarde);
  return isNaN(n) ? null : n;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { label: string; volledigeWaarde: string; eenheid: string } }>;
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border border-slate-100 rounded-xl px-3 py-2 shadow-sm text-xs">
      <p className="text-slate-500">{p.label}</p>
      <p className="font-semibold text-slate-800 mt-0.5">
        {p.volledigeWaarde} {p.eenheid}
      </p>
    </div>
  );
}

export default function MetingenClient({
  metingen: initieleMetingen,
  userId,
  ownerId,
  isBeheerder = true,
  eigenNaam = null,
}: {
  metingen: Meting[];
  userId: string;
  ownerId: string;
  isBeheerder?: boolean;
  eigenNaam?: string | null;
}) {
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);
  const [metingen, setMetingen] = useState<Meting[]>(initieleMetingen);
  const [actieveTab, setActieveTab] = useState(MEETTYPEN[0].type);

  useEffect(() => { setMounted(true); }, []);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const now = getNow();

  // Form state
  const [formType, setFormType] = useState(MEETTYPEN[0].type);
  const [formWaarde, setFormWaarde] = useState('');
  const [formEenheid, setFormEenheid] = useState(MEETTYPEN[0].eenheid);
  const [formDatum, setFormDatum] = useState(now.date);
  const [formTijdstip, setFormTijdstip] = useState(now.time);
  const [formGemetenDoor, setFormGemetenDoor] = useState(eigenNaam ?? '');
  const [formNotities, setFormNotities] = useState('');

  const activeMeettype = MEETTYPEN.find((m) => m.type === formType) ?? MEETTYPEN[0];

  function handleTypeChange(type: string) {
    const mt = MEETTYPEN.find((m) => m.type === type) ?? MEETTYPEN[0];
    setFormType(type);
    setFormEenheid(mt.eenheid);
    setFormWaarde('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formWaarde.trim()) return;
    setLoading(true);
    setFout(null);

    const { data, error } = await supabase
      .from('metingen')
      .insert({
        owner_id: ownerId,
        type: formType,
        waarde: formWaarde.trim(),
        eenheid: formEenheid.trim(),
        datum: formDatum,
        tijdstip: formTijdstip || null,
        notities: formNotities.trim() || null,
        gemeten_door_naam: (!isBeheerder && eigenNaam) ? eigenNaam : (formGemetenDoor.trim() || null),
      })
      .select('id, type, waarde, eenheid, datum, tijdstip, notities, gemeten_door_naam, created_at')
      .single();

    setLoading(false);

    if (error) {
      setFout(error.message);
      return;
    }

    if (data) {
      setMetingen((prev) => [data, ...prev]);
      setActieveTab(formType);
    }

    setFormWaarde('');
    setFormNotities('');
    setFormGemetenDoor(eigenNaam ?? '');
    const nowReset = getNow();
    setFormDatum(nowReset.date);
    setFormTijdstip(nowReset.time);
    setShowForm(false);
  }

  const metingenVoorTab = useMemo(
    () => metingen.filter((m) => m.type === actieveTab),
    [metingen, actieveTab]
  );

  const recentste = metingenVoorTab[0] ?? null;

  const aktieveTabInfo = MEETTYPEN.find((m) => m.type === actieveTab);

  const grafiekData = useMemo(() => {
    return [...metingenVoorTab]
      .slice(0, 30)
      .reverse()
      .map((m) => ({
        label: `${formatDatum(m.datum)}${m.tijdstip ? ' ' + formatTijdstip(m.tijdstip) : ''}`,
        waarde: parseWaardeNumeriek(m.waarde),
        volledigeWaarde: m.waarde,
        eenheid: m.eenheid,
      }))
      .filter((d) => d.waarde !== null);
  }, [metingenVoorTab]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Metingen</h1>
          <p className="text-sm text-slate-400 mt-0.5">Bijhouden van gezondheidswaarden</p>
        </div>
        <button
          onClick={() => {
            const mt = MEETTYPEN.find((m) => m.type === actieveTab) ?? MEETTYPEN[0];
            setFormType(mt.type);
            setFormEenheid(mt.eenheid);
            setFormWaarde('');
            setShowForm((v) => !v);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nieuwe meting
        </button>
      </div>

      {/* Formulier */}
      {showForm && (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Meting toevoegen</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Meettype</label>
                <select
                  value={formType}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                >
                  {MEETTYPEN.map((mt) => (
                    <option key={mt.type} value={mt.type}>
                      {mt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Waarde */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Waarde</label>
                <input
                  type="text"
                  value={formWaarde}
                  onChange={(e) => setFormWaarde(e.target.value)}
                  placeholder={activeMeettype.placeholder}
                  required
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                />
              </div>

              {/* Eenheid */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Eenheid</label>
                <input
                  type="text"
                  value={formEenheid}
                  onChange={(e) => setFormEenheid(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                />
              </div>

              {/* Gemeten door */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Gemeten door</label>
                {!isBeheerder && eigenNaam ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0">
                      {eigenNaam[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-slate-700 font-medium">{eigenNaam}</span>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={formGemetenDoor}
                    onChange={(e) => setFormGemetenDoor(e.target.value)}
                    placeholder="Naam zorgverlener"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  />
                )}
              </div>

              {/* Datum */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Datum</label>
                <input
                  type="date"
                  value={formDatum}
                  onChange={(e) => setFormDatum(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                />
              </div>

              {/* Tijdstip */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Tijdstip</label>
                <input
                  type="time"
                  value={formTijdstip}
                  onChange={(e) => setFormTijdstip(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                />
              </div>
            </div>

            {/* Notitie */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Notitie (optioneel)</label>
              <textarea
                value={formNotities}
                onChange={(e) => setFormNotities(e.target.value)}
                rows={2}
                placeholder="Eventuele opmerkingen..."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 resize-none"
              />
            </div>

            {fout && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {fout}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl transition-colors"
              >
                {loading ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {MEETTYPEN.map((mt) => {
          const count = metingen.filter((m) => m.type === mt.type).length;
          const isActief = actieveTab === mt.type;
          return (
            <button
              key={mt.type}
              onClick={() => setActieveTab(mt.type)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
                isActief
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-slate-100 text-slate-500 hover:text-slate-800 hover:border-slate-200'
              }`}
            >
              {mt.label}
              {count > 0 && (
                <span
                  className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                    isActief ? 'bg-indigo-500 text-indigo-100' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Overzicht voor het actieve type */}
      <div className="space-y-4">
        {/* Meest recente waarde */}
        {recentste ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
              Laatste meting — {aktieveTabInfo?.label}
            </p>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-4xl font-bold text-slate-900 leading-none">{recentste.waarde}</span>
              <span className="text-lg text-slate-400 font-medium pb-0.5">{recentste.eenheid}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <span className="text-xs text-slate-500">
                {formatDatum(recentste.datum)}
                {recentste.tijdstip ? ` om ${formatTijdstip(recentste.tijdstip)}` : ''}
              </span>
              {recentste.gemeten_door_naam && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {recentste.gemeten_door_naam}
                </span>
              )}
              {recentste.notities && (
                <span className="text-xs text-slate-400 italic">{recentste.notities}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center">
            <p className="text-sm text-slate-400">Nog geen metingen voor {aktieveTabInfo?.label?.toLowerCase()}.</p>
          </div>
        )}

        {/* Grafiek */}
        {grafiekData.length >= 2 && mounted && (
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-500 mb-4">
              Verloop — laatste {grafiekData.length} metingen
              {aktieveTab === 'bloeddruk' && (
                <span className="text-slate-400"> (systolische waarde)</span>
              )}
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={grafiekData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={false}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="waarde"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#6366f1', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Lijst */}
        {metingenVoorTab.length > 0 && (
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-50">
              <p className="text-xs font-medium text-slate-500">Alle metingen</p>
            </div>
            <ul className="divide-y divide-slate-50">
              {metingenVoorTab.map((meting) => (
                <li key={meting.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-semibold text-slate-800">{meting.waarde}</span>
                      <span className="text-xs text-slate-400">{meting.eenheid}</span>
                    </div>
                    {meting.notities && (
                      <p className="text-xs text-slate-400 italic truncate mt-0.5">{meting.notities}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-xs text-slate-500">{formatDatum(meting.datum)}</p>
                    {meting.tijdstip && (
                      <p className="text-xs text-slate-400">{formatTijdstip(meting.tijdstip)}</p>
                    )}
                    {meting.gemeten_door_naam && (
                      <p className="text-xs text-slate-400">{meting.gemeten_door_naam}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
