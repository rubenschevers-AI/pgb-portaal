'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type Lid = {
  id: string;
  naam: string;
  rol: string;
  status: string;
  email?: string;
  telefoon?: string;
  member_user_id?: string;
  uurtarief?: number;
};

const ROLLEN = ['zorgverlener', 'begeleider', 'verpleegkundige', 'huishoudelijke hulp'];

export default function TeamClient({ leden, userId }: { leden: Lid[]; userId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [editLid, setEditLid] = useState<Lid | null>(null);
  const [naam, setNaam] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('zorgverlener');
  const [telefoon, setTelefoon] = useState('');
  const [uurtarief, setUurtarief] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const openToevoegen = () => {
    setEditLid(null);
    setNaam(''); setEmail(''); setRol('zorgverlener'); setTelefoon(''); setUurtarief('');
    setError('');
    setShowForm(true);
  };

  const openBewerken = (lid: Lid) => {
    setEditLid(lid);
    setNaam(lid.naam);
    setEmail(lid.email ?? '');
    setRol(lid.rol);
    setTelefoon(lid.telefoon ?? '');
    setUurtarief(lid.uurtarief?.toString() ?? '');
    setError('');
    setShowForm(true);
  };

  const handleOpslaan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const velden = {
      naam,
      email,
      rol,
      telefoon: telefoon || null,
      uurtarief: uurtarief ? parseFloat(uurtarief) : null,
    };

    if (editLid) {
      const { error: err } = await supabase.from('team_members').update(velden).eq('id', editLid.id);
      if (err) { setError('Kon wijzigingen niet opslaan: ' + err.message); setLoading(false); return; }
    } else {
      const { error: err } = await supabase.from('team_members').insert({
        ...velden,
        status: 'actief',
        owner_id: userId,
      });
      if (err) { setError('Kon teamlid niet toevoegen: ' + err.message); setLoading(false); return; }
    }

    setShowForm(false);
    setEditLid(null);
    setLoading(false);
    router.refresh();
  };

  const handleStatusToggle = async (lid: Lid) => {
    const nieuwStatus = lid.status === 'actief' ? 'inactief' : 'actief';
    await supabase.from('team_members').update({ status: nieuwStatus }).eq('id', lid.id);
    router.refresh();
  };

  const handleVerwijder = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit teamlid wilt verwijderen?')) return;
    await supabase.from('team_members').delete().eq('id', id);
    router.refresh();
  };

  const actief = leden.filter(l => l.status === 'actief');
  const inactief = leden.filter(l => l.status !== 'actief');

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Team</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {actief.length} actieve zorgverlener{actief.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openToevoegen}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition"
        >
          + Toevoegen
        </button>
      </div>

      {/* Formulier */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-5">
          <h2 className="font-semibold text-slate-800 mb-4 text-sm">
            {editLid ? `${editLid.naam} bewerken` : 'Nieuw teamlid'}
          </h2>
          <form onSubmit={handleOpslaan} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Naam *</label>
                <input
                  type="text"
                  value={naam}
                  onChange={e => setNaam(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Voornaam Achternaam"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">E-mail *</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="naam@voorbeeld.nl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Rol</label>
                <select
                  value={rol}
                  onChange={e => setRol(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {ROLLEN.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Telefoon</label>
                <input
                  type="tel"
                  value={telefoon}
                  onChange={e => setTelefoon(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="06-12345678"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Uurtarief (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={uurtarief}
                  onChange={e => setUurtarief(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="bijv. 18.50"
                />
              </div>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2 rounded-xl">{error}</div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-sm transition"
              >
                {loading ? 'Opslaan...' : editLid ? 'Opslaan' : 'Toevoegen'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditLid(null); }}
                className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition"
              >
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Actieve leden */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-4">
        <div className="px-5 py-3.5 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 text-sm">Actieve zorgverleners</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{actief.length}</span>
        </div>
        {actief.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-slate-400 mb-3">Nog geen actieve zorgverleners.</p>
            <button onClick={openToevoegen} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">
              + Eerste teamlid toevoegen
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {actief.map(lid => (
              <LidRij key={lid.id} lid={lid} onBewerken={openBewerken} onToggle={handleStatusToggle} onVerwijder={handleVerwijder} />
            ))}
          </div>
        )}
      </div>

      {/* Inactieve leden */}
      {inactief.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Inactief</h2>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{inactief.length}</span>
          </div>
          <div className="divide-y divide-slate-50">
            {inactief.map(lid => (
              <LidRij key={lid.id} lid={lid} onBewerken={openBewerken} onToggle={handleStatusToggle} onVerwijder={handleVerwijder} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LidRij({ lid, onBewerken, onToggle, onVerwijder }: {
  lid: Lid;
  onBewerken: (l: Lid) => void;
  onToggle: (l: Lid) => void;
  onVerwijder: (id: string) => void;
}) {
  const isActief = lid.status === 'actief';
  return (
    <div className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50/60 transition">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
        isActief ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
      }`}>
        {lid.naam?.[0] ?? '?'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{lid.naam}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-slate-400 capitalize">{lid.rol}</span>
          {lid.email && <span className="text-xs text-slate-300">·</span>}
          {lid.email && <span className="text-xs text-slate-400 truncate max-w-40">{lid.email}</span>}
          {lid.telefoon && <span className="text-xs text-slate-300 hidden md:inline">·</span>}
          {lid.telefoon && <span className="text-xs text-slate-400 hidden md:inline">{lid.telefoon}</span>}
          {lid.uurtarief && <span className="text-xs text-slate-400 hidden md:inline">€{lid.uurtarief}/u</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onBewerken(lid)}
          className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition hidden sm:block"
        >
          Bewerken
        </button>
        <button
          onClick={() => onToggle(lid)}
          className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition"
        >
          {isActief ? 'Pauzeer' : 'Activeer'}
        </button>
        <button
          onClick={() => onVerwijder(lid.id)}
          className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition"
        >
          ×
        </button>
      </div>
    </div>
  );
}
