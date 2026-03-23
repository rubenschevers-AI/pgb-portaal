'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type Medicijn = {
  id: string;
  owner_id: string;
  naam: string;
  dosering?: string;
  frequentie?: string;
  tijdstip?: string;
  notities?: string;
  actief: boolean;
  created_at: string;
};

type Toediening = {
  id: string;
  medicatie_id: string;
  owner_id: string;
  datum: string;
  tijdstip?: string;
  status: 'niet_gedaan' | 'toegediend' | 'geweigerd';
  afgevinkt_door?: string;
  afgevinkt_door_naam?: string;
  opmerking?: string;
  created_at: string;
};

type AfvinkenModal = {
  medicijnId: string;
  medicijnNaam: string;
  bestaandeToediening?: Toediening;
};

const FREQUENTIES = ['dagelijks', '2x daags', '3x daags', 'wekelijks', 'maandelijks'];

function getLaatste7Dagen(vanafDatum: string): string[] {
  const dagen: string[] = [];
  const start = new Date(vanafDatum);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dagen.push(d.toISOString().split('T')[0]);
  }
  return dagen;
}

function StatusBadge({ status }: { status: 'niet_gedaan' | 'toegediend' | 'geweigerd' }) {
  if (status === 'toegediend') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        Toegediend
      </span>
    );
  }
  if (status === 'geweigerd') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
        Geweigerd
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200">
      Niet gedaan
    </span>
  );
}

function ComplianceDot({ status }: { status: 'toegediend' | 'geweigerd' | 'niet_gedaan' | 'onbekend' }) {
  if (status === 'toegediend') return <div className="w-3 h-3 rounded-full bg-emerald-500" title="Toegediend" />;
  if (status === 'geweigerd') return <div className="w-3 h-3 rounded-full bg-red-400" title="Geweigerd" />;
  if (status === 'niet_gedaan') return <div className="w-3 h-3 rounded-full bg-slate-200" title="Niet gedaan" />;
  return <div className="w-3 h-3 rounded-full bg-slate-100 border border-dashed border-slate-300" title="Geen data" />;
}

export default function MedicatieClient({
  medicatie,
  toedieningen,
  userId,
  vandaag,
  vanafDatum,
}: {
  medicatie: Medicijn[];
  toedieningen: Toediening[];
  userId: string;
  vandaag: string;
  vanafDatum: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  // ── Lokale state ──────────────────────────────────────────
  const [lokaleToedieningen, setLokaleToedieningen] = useState<Toediening[]>(toedieningen);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'actief' | 'alles'>('actief');
  const [loading, setLoading] = useState(false);

  // Nieuw medicijn formulier
  const [formNaam, setFormNaam] = useState('');
  const [formDosering, setFormDosering] = useState('');
  const [formFrequentie, setFormFrequentie] = useState('dagelijks');
  const [formTijdstip, setFormTijdstip] = useState('08:00');
  const [formNotities, setFormNotities] = useState('');

  // Afvinken modal
  const [afvinkenModal, setAfvinkenModal] = useState<AfvinkenModal | null>(null);
  const [modalNaam, setModalNaam] = useState('');
  const [modalStatus, setModalStatus] = useState<'toegediend' | 'geweigerd'>('toegediend');
  const [modalOpmerking, setModalOpmerking] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // ── Helper functies ───────────────────────────────────────
  const getToediening = (medicatieId: string, datum: string) =>
    lokaleToedieningen.find(t => t.medicatie_id === medicatieId && t.datum === datum);

  const getVandaagToediening = (medicatieId: string) =>
    getToediening(medicatieId, vandaag);

  const dagen = getLaatste7Dagen(vanafDatum);

  const berekenCompliance = (medicijnId: string) => {
    const count = lokaleToedieningen.filter(
      t => t.medicatie_id === medicijnId && t.status === 'toegediend'
    ).length;
    return count;
  };

  // ── Medicijn toevoegen ────────────────────────────────────
  const handleToevoegen = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await supabase.from('medicatie').insert({
      naam: formNaam,
      dosering: formDosering || null,
      frequentie: formFrequentie || null,
      tijdstip: formTijdstip || null,
      notities: formNotities || null,
      actief: true,
      owner_id: userId,
    });
    setFormNaam('');
    setFormDosering('');
    setFormFrequentie('dagelijks');
    setFormTijdstip('08:00');
    setFormNotities('');
    setShowForm(false);
    setLoading(false);
    router.refresh();
  };

  // ── Activeren / deactiveren ───────────────────────────────
  const handleToggleActief = async (medicijn: Medicijn) => {
    await supabase
      .from('medicatie')
      .update({ actief: !medicijn.actief })
      .eq('id', medicijn.id);
    router.refresh();
  };

  // ── Afvinken modal openen ─────────────────────────────────
  const openAfvinkenModal = (medicijn: Medicijn) => {
    const bestaande = getVandaagToediening(medicijn.id);
    setAfvinkenModal({
      medicijnId: medicijn.id,
      medicijnNaam: medicijn.naam,
      bestaandeToediening: bestaande,
    });
    setModalNaam(bestaande?.afgevinkt_door_naam ?? '');
    setModalStatus(bestaande?.status === 'geweigerd' ? 'geweigerd' : 'toegediend');
    setModalOpmerking(bestaande?.opmerking ?? '');
  };

  // ── Toediening opslaan (upsert) ───────────────────────────
  const handleAfvinkenBevestig = async () => {
    if (!afvinkenModal || !modalNaam.trim()) return;
    setModalLoading(true);

    const bestaande = getVandaagToediening(afvinkenModal.medicijnId);

    const payload = {
      medicatie_id: afvinkenModal.medicijnId,
      owner_id: userId,
      datum: vandaag,
      status: modalStatus,
      afgevinkt_door: userId,
      afgevinkt_door_naam: modalNaam.trim(),
      opmerking: modalOpmerking.trim() || null,
    };

    let resultId = bestaande?.id;

    if (bestaande) {
      const { data } = await supabase
        .from('medicatie_toedieningen')
        .update({
          status: payload.status,
          afgevinkt_door: payload.afgevinkt_door,
          afgevinkt_door_naam: payload.afgevinkt_door_naam,
          opmerking: payload.opmerking,
        })
        .eq('id', bestaande.id)
        .select('*')
        .single();

      if (data) {
        setLokaleToedieningen(prev =>
          prev.map(t => (t.id === bestaande.id ? data : t))
        );
        resultId = data.id;
      }
    } else {
      const { data } = await supabase
        .from('medicatie_toedieningen')
        .insert(payload)
        .select('*')
        .single();

      if (data) {
        setLokaleToedieningen(prev => [...prev, data]);
        resultId = data.id;
      }
    }

    void resultId;
    setModalLoading(false);
    setAfvinkenModal(null);
    setModalNaam('');
    setModalOpmerking('');
  };

  // ── Toediening ongedaan maken ─────────────────────────────
  const handleOngedaan = async (medicijnId: string) => {
    const toediening = getVandaagToediening(medicijnId);
    if (!toediening) return;
    await supabase.from('medicatie_toedieningen').delete().eq('id', toediening.id);
    setLokaleToedieningen(prev => prev.filter(t => t.id !== toediening.id));
  };

  // ── Gefilterde lijst ──────────────────────────────────────
  const gefilterd = filter === 'actief'
    ? medicatie.filter(m => m.actief)
    : medicatie;

  const actiefMedicatie = medicatie.filter(m => m.actief);

  const aantalVandaagToegedient = actiefMedicatie.filter(m => {
    const t = getVandaagToediening(m.id);
    return t?.status === 'toegediend';
  }).length;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Medicatie</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {aantalVandaagToegedient} van {actiefMedicatie.length} toegediend vandaag
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-xl p-0.5 text-sm">
            <button
              onClick={() => setFilter('actief')}
              className={`px-3 py-1.5 rounded-xl font-medium transition text-sm ${
                filter === 'actief' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
              }`}
            >
              Actief
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
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition"
          >
            + Medicijn
          </button>
        </div>
      </div>

      {/* ── Voortgangsbalk ─────────────────────────────────── */}
      {actiefMedicatie.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-600">Voortgang vandaag</p>
            <p className="text-xs font-bold text-indigo-600">
              {actiefMedicatie.length > 0
                ? Math.round((aantalVandaagToegedient / actiefMedicatie.length) * 100)
                : 0}%
            </p>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{
                width: actiefMedicatie.length > 0
                  ? `${Math.round((aantalVandaagToegedient / actiefMedicatie.length) * 100)}%`
                  : '0%',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Nieuw medicijn formulier ──────────────────────── */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-5">
          <h2 className="font-semibold text-slate-800 mb-4 text-sm">Nieuw medicijn toevoegen</h2>
          <form onSubmit={handleToevoegen} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Naam *</label>
                <input
                  type="text"
                  value={formNaam}
                  onChange={e => setFormNaam(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="bijv. Paracetamol"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dosering</label>
                <input
                  type="text"
                  value={formDosering}
                  onChange={e => setFormDosering(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="bijv. 500mg"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Frequentie</label>
                <select
                  value={formFrequentie}
                  onChange={e => setFormFrequentie(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {FREQUENTIES.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tijdstip</label>
                <input
                  type="time"
                  value={formTijdstip}
                  onChange={e => setFormTijdstip(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notities</label>
              <textarea
                value={formNotities}
                onChange={e => setFormNotities(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Optionele opmerkingen..."
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-sm transition"
              >
                {loading ? 'Opslaan...' : 'Toevoegen'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition"
              >
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Sectie: Vandaag ───────────────────────────────── */}
      {actiefMedicatie.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Vandaag</h2>
          <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
            {actiefMedicatie.map(medicijn => {
              const toediening = getVandaagToediening(medicijn.id);
              const status = toediening?.status ?? 'niet_gedaan';
              const isAfgevinkt = !!toediening;

              return (
                <div key={medicijn.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition">
                  {/* Status indicator */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      status === 'toegediend'
                        ? 'bg-emerald-100'
                        : status === 'geweigerd'
                        ? 'bg-red-100'
                        : 'bg-slate-100'
                    }`}
                  >
                    {status === 'toegediend' ? (
                      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : status === 'geweigerd' ? (
                      <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800">{medicijn.naam}</p>
                      {medicijn.dosering && (
                        <span className="text-xs text-slate-500">{medicijn.dosering}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {medicijn.tijdstip && (
                        <span className="text-xs text-slate-400">{medicijn.tijdstip}</span>
                      )}
                      {medicijn.frequentie && (
                        <span className="text-xs text-slate-400">{medicijn.frequentie}</span>
                      )}
                      <StatusBadge status={status as 'niet_gedaan' | 'toegediend' | 'geweigerd'} />
                    </div>
                    {isAfgevinkt && toediening.afgevinkt_door_naam && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        door {toediening.afgevinkt_door_naam}
                        {toediening.opmerking && (
                          <span className="text-slate-300"> &mdash; {toediening.opmerking}</span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Acties */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isAfgevinkt ? (
                      <>
                        <button
                          onClick={() => openAfvinkenModal(medicijn)}
                          className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition"
                        >
                          Wijzig
                        </button>
                        <button
                          onClick={() => handleOngedaan(medicijn.id)}
                          className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition"
                        >
                          Ongedaan
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => openAfvinkenModal(medicijn)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition"
                      >
                        Afvinken
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Sectie: Overzicht (compliance 7 dagen) ──────── */}
      {medicatie.filter(m => m.actief).length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Overzicht afgelopen 7 dagen</h2>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            {/* Dag-headers */}
            <div className="px-5 pt-4 pb-2 border-b border-slate-50">
              <div className="flex items-center">
                <div className="flex-1 min-w-0" />
                <div className="flex items-center gap-1.5 shrink-0">
                  {dagen.map(dag => {
                    const d = new Date(dag);
                    const isVandaagDag = dag === vandaag;
                    return (
                      <div key={dag} className="w-7 text-center">
                        <p className={`text-[10px] font-medium ${isVandaagDag ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][d.getDay()]}
                        </p>
                        <p className={`text-[10px] ${isVandaagDag ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>
                          {d.getDate()}
                        </p>
                      </div>
                    );
                  })}
                  <div className="w-12 text-right">
                    <p className="text-[10px] text-slate-400 font-medium">Score</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-50">
              {medicatie.filter(m => m.actief).map(medicijn => {
                const compliance = berekenCompliance(medicijn.id);
                return (
                  <div key={medicijn.id} className="flex items-center px-5 py-3.5 hover:bg-slate-50/40 transition">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-medium text-slate-800 truncate">{medicijn.naam}</p>
                      {medicijn.dosering && (
                        <p className="text-xs text-slate-400">{medicijn.dosering}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {dagen.map(dag => {
                        const t = getToediening(medicijn.id, dag);
                        const dotStatus = t ? t.status : (dag <= vandaag ? 'niet_gedaan' : 'onbekend');
                        return (
                          <div key={dag} className="w-7 flex justify-center">
                            <ComplianceDot status={dotStatus as 'toegediend' | 'geweigerd' | 'niet_gedaan' | 'onbekend'} />
                          </div>
                        );
                      })}
                      <div className="w-12 text-right">
                        <span className={`text-xs font-bold ${
                          compliance >= 6 ? 'text-emerald-600' :
                          compliance >= 4 ? 'text-amber-500' :
                          'text-red-500'
                        }`}>
                          {compliance}/7
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Sectie: Alle medicijnen (beheer) ─────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Medicijnen beheren</h2>
        {gefilterd.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <p className="text-slate-400 text-sm">Nog geen medicijnen. Voeg je eerste medicijn toe.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
            {gefilterd.map(medicijn => (
              <div
                key={medicijn.id}
                className={`flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition ${!medicijn.actief ? 'opacity-50' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">{medicijn.naam}</p>
                    {!medicijn.actief && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                        Inactief
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {medicijn.dosering && (
                      <span className="text-xs text-slate-500">{medicijn.dosering}</span>
                    )}
                    {medicijn.frequentie && (
                      <span className="text-xs text-slate-400">{medicijn.frequentie}</span>
                    )}
                    {medicijn.tijdstip && (
                      <span className="text-xs text-slate-400">{medicijn.tijdstip}</span>
                    )}
                    {medicijn.notities && (
                      <span className="text-xs text-slate-300 truncate max-w-xs hidden lg:inline">
                        {medicijn.notities}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleToggleActief(medicijn)}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition shrink-0"
                >
                  {medicijn.actief ? 'Deactiveer' : 'Activeer'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal: Afvinken ───────────────────────────────── */}
      {afvinkenModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setAfvinkenModal(null)}
          />
          <div className="relative z-50 bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-w-sm mx-0 md:mx-4 p-6">
            <h2 className="font-bold text-slate-900 mb-1 text-base">Toediening registreren</h2>
            <p className="text-sm text-slate-400 mb-5">{afvinkenModal.medicijnNaam}</p>

            {/* Status keuze */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-2">Status</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalStatus('toegediend')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${
                    modalStatus === 'toegediend'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Toegediend
                </button>
                <button
                  type="button"
                  onClick={() => setModalStatus('geweigerd')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${
                    modalStatus === 'geweigerd'
                      ? 'bg-red-50 border-red-300 text-red-700'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Geweigerd
                </button>
              </div>
            </div>

            {/* Naam invoer */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Wie heeft toegediend? *
              </label>
              <input
                type="text"
                value={modalNaam}
                onChange={e => setModalNaam(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Naam zorgverlener of beheerder"
                autoFocus
              />
            </div>

            {/* Opmerking */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Opmerking (optioneel)
              </label>
              <textarea
                value={modalOpmerking}
                onChange={e => setModalOpmerking(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="bijv. half tablet gegeven"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAfvinkenBevestig}
                disabled={!modalNaam.trim() || modalLoading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition"
              >
                {modalLoading ? 'Opslaan...' : 'Bevestigen'}
              </button>
              <button
                onClick={() => setAfvinkenModal(null)}
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
