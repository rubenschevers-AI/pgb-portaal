'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function ProfielClient({
  userId,
  email,
  voornaam: initVoornaam,
  achternaam: initAchternaam,
}: {
  userId: string;
  email: string;
  voornaam: string;
  achternaam: string;
}) {
  const [voornaam, setVoornaam] = useState(initVoornaam);
  const [achternaam, setAchternaam] = useState(initAchternaam);
  const [loading, setLoading] = useState(false);
  const [opgeslagen, setOpgeslagen] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleOpslaan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setOpgeslagen(false);

    const { error: err } = await supabase
      .from('profiles')
      .upsert({ user_id: userId, voornaam, achternaam, email }, { onConflict: 'user_id' });

    if (err) {
      setError('Kon profiel niet opslaan: ' + err.message);
    } else {
      setOpgeslagen(true);
      router.refresh();
    }
    setLoading(false);
  };

  const volledigeNaam = [voornaam, achternaam].filter(Boolean).join(' ');
  const initialen = [voornaam, achternaam]
    .filter(Boolean)
    .map(n => n[0].toUpperCase())
    .join('') || email[0].toUpperCase();

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Profiel</h1>
        <p className="text-sm text-slate-400 mt-0.5">Persoonlijke gegevens beheren</p>
      </div>

      {/* Profiel card */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {/* Avatar sectie */}
        <div className="px-6 py-5 border-b border-slate-50 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-700 shrink-0">
            {initialen}
          </div>
          <div>
            <p className="font-bold text-slate-900">
              {volledigeNaam || 'Naam nog niet ingesteld'}
            </p>
            <p className="text-sm text-slate-400">{email}</p>
            <span className="inline-block mt-1 text-xs font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
              Budgethouder
            </span>
          </div>
        </div>

        {/* Formulier */}
        <form onSubmit={handleOpslaan} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Voornaam</label>
              <input
                type="text"
                value={voornaam}
                onChange={e => { setVoornaam(e.target.value); setOpgeslagen(false); }}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                placeholder="bijv. Jan"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Achternaam</label>
              <input
                type="text"
                value={achternaam}
                onChange={e => { setAchternaam(e.target.value); setOpgeslagen(false); }}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                placeholder="bijv. de Vries"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">E-mailadres</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-3 py-2.5 border border-slate-100 rounded-xl text-sm text-slate-400 bg-slate-50 cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 mt-1">E-mail kan niet worden gewijzigd via het portaal</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">{error}</div>
          )}
          {opgeslagen && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-2.5 rounded-xl flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Profiel succesvol opgeslagen
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition"
            >
              {loading ? 'Opslaan...' : 'Wijzigingen opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
