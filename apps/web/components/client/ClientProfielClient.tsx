'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type ClientProfiel = {
  id: string;
  owner_id: string;
  naam: string | null;
  geboortedatum: string | null;
  foto_url: string | null;
  omschrijving: string | null;
  aandoeningen: string | null;
  bijzonderheden: string | null;
};

type Props = {
  profiel: ClientProfiel | null;
  userId: string;
  ownerId: string;
  isBeheerder: boolean;
};

function leeftijd(geboortedatum: string): number {
  const d = new Date(geboortedatum);
  const nu = new Date();
  let age = nu.getFullYear() - d.getFullYear();
  if (nu.getMonth() < d.getMonth() || (nu.getMonth() === d.getMonth() && nu.getDate() < d.getDate())) age--;
  return age;
}

export default function ClientProfielClient({ profiel: initProfiel, userId, ownerId, isBeheerder }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [profiel, setProfiel] = useState<ClientProfiel | null>(initProfiel);
  const [editing, setEditing] = useState(!initProfiel && isBeheerder);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    naam: initProfiel?.naam ?? '',
    geboortedatum: initProfiel?.geboortedatum ?? '',
    foto_url: initProfiel?.foto_url ?? '',
    omschrijving: initProfiel?.omschrijving ?? '',
    aandoeningen: initProfiel?.aandoeningen ?? '',
    bijzonderheden: initProfiel?.bijzonderheden ?? '',
  });

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      owner_id: ownerId,
      naam: form.naam || null,
      geboortedatum: form.geboortedatum || null,
      foto_url: form.foto_url || null,
      omschrijving: form.omschrijving || null,
      aandoeningen: form.aandoeningen || null,
      bijzonderheden: form.bijzonderheden || null,
    };

    let result;
    if (profiel) {
      result = await supabase
        .from('client_profiel')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', profiel.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('client_profiel')
        .insert(payload)
        .select()
        .single();
    }

    if (!result.error && result.data) {
      setProfiel(result.data as ClientProfiel);
      setEditing(false);
    }
    setSaving(false);
  };

  const startEdit = () => {
    setForm({
      naam: profiel?.naam ?? '',
      geboortedatum: profiel?.geboortedatum ?? '',
      foto_url: profiel?.foto_url ?? '',
      omschrijving: profiel?.omschrijving ?? '',
      aandoeningen: profiel?.aandoeningen ?? '',
      bijzonderheden: profiel?.bijzonderheden ?? '',
    });
    setEditing(true);
  };

  /* ── Empty state for beheerder ── */
  if (!profiel && !editing && isBeheerder) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Voeg clientinfo toe</h2>
          <p className="text-sm text-slate-500 mb-6">Maak een introductie voor je zorgverleners zodat ze weten wie ze begeleiden.</p>
          <button
            onClick={() => setEditing(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition"
          >
            Profiel aanmaken
          </button>
        </div>
      </div>
    );
  }

  /* ── Empty state for team member ── */
  if (!profiel && !isBeheerder) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500">Nog geen clientprofiel beschikbaar.</p>
        </div>
      </div>
    );
  }

  /* ── Edit form ── */
  if (editing && isBeheerder) {
    return (
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-5xl mx-auto space-y-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-900">Clientprofiel bewerken</h2>
            <button
              onClick={() => { setEditing(false); }}
              className="text-sm text-slate-500 hover:text-slate-700 transition"
            >
              Annuleren
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Naam cliënt</label>
              <input
                type="text"
                value={form.naam}
                onChange={e => setForm(p => ({ ...p, naam: e.target.value }))}
                placeholder="Volledige naam"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Geboortedatum</label>
              <input
                type="date"
                value={form.geboortedatum}
                onChange={e => setForm(p => ({ ...p, geboortedatum: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Foto URL (optioneel)</label>
            <input
              type="url"
              value={form.foto_url}
              onChange={e => setForm(p => ({ ...p, foto_url: e.target.value }))}
              placeholder="https://..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Verhaal / introductie</label>
            <textarea
              value={form.omschrijving}
              onChange={e => setForm(p => ({ ...p, omschrijving: e.target.value }))}
              rows={5}
              placeholder="Wie is deze persoon? Wat maakt hem/haar bijzonder?"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Zorgvraag & bijzonderheden</label>
            <textarea
              value={form.bijzonderheden}
              onChange={e => setForm(p => ({ ...p, bijzonderheden: e.target.value }))}
              rows={3}
              placeholder="Wat heeft deze persoon nodig? Bijzondere aandachtspunten..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Diagnoses / aandoeningen</label>
            <textarea
              value={form.aandoeningen}
              onChange={e => setForm(p => ({ ...p, aandoeningen: e.target.value }))}
              rows={2}
              placeholder="Relevante diagnoses of aandoeningen voor zorgverleners..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition flex items-center gap-2"
            >
              {saving && <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />}
              Opslaan
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── View mode ── */
  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
      <div className="max-w-5xl mx-auto">
        {/* Header card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 mb-5 flex items-start gap-5">
          {profiel!.foto_url ? (
            <img
              src={profiel!.foto_url}
              alt={profiel!.naam ?? 'Cliënt'}
              className="w-20 h-20 rounded-2xl object-cover shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
              <span className="text-3xl font-bold text-indigo-600">
                {profiel!.naam?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">{profiel!.naam ?? 'Onbekend'}</h1>
            {profiel!.geboortedatum && (
              <p className="text-sm text-slate-500 mt-0.5">
                {new Date(profiel!.geboortedatum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' '}· {leeftijd(profiel!.geboortedatum)} jaar
              </p>
            )}
            {isBeheerder && (
              <button
                onClick={startEdit}
                className="mt-3 px-4 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-medium transition"
              >
                Bewerken
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {profiel!.omschrijving && (
            <div className="bg-white border border-slate-100 rounded-2xl p-5">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Verhaal</h2>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{profiel!.omschrijving}</p>
            </div>
          )}

          {profiel!.bijzonderheden && (
            <div className="bg-white border border-slate-100 rounded-2xl p-5">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Zorgvraag & bijzonderheden</h2>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{profiel!.bijzonderheden}</p>
            </div>
          )}

          {profiel!.aandoeningen && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
              <h2 className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-3">Diagnoses / aandoeningen</h2>
              <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">{profiel!.aandoeningen}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
