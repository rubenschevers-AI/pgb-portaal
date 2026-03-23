'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Taak = {
  id: string;
  titel: string;
  prioriteit?: string;
  status: string;
  gedaanVandaag: boolean;
};

export default function DashboardTakenWidget({
  taken: initTaken,
  vandaag,
  userId,
}: {
  taken: Taak[];
  vandaag: string;
  userId: string;
}) {
  const supabase = createClient();
  const [taken, setTaken] = useState<Taak[]>(initTaken);

  const actief = taken.filter(t => t.status === 'actief');
  const gedaan = actief.filter(t => t.gedaanVandaag).length;
  const progress = actief.length > 0 ? Math.round((gedaan / actief.length) * 100) : 0;

  const handleToggle = async (taak: Taak) => {
    if (taak.gedaanVandaag) {
      // Undo: delete afvinkvink vandaag
      await supabase
        .from('taken_afvinkingen')
        .delete()
        .eq('taak_id', taak.id)
        .eq('datum', vandaag);
      setTaken(prev => prev.map(t => t.id === taak.id ? { ...t, gedaanVandaag: false } : t));
    } else {
      // Check off
      await supabase
        .from('taken_afvinkingen')
        .insert({ taak_id: taak.id, datum: vandaag, afgevinkt_door: userId });
      setTaken(prev => prev.map(t => t.id === taak.id ? { ...t, gedaanVandaag: true } : t));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-slate-800 text-sm">Taken vandaag</h2>
          {actief.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-slate-400">{gedaan}/{actief.length}</span>
            </div>
          )}
        </div>
        <Link href="/taken" className="text-xs text-indigo-600 font-medium hover:text-indigo-700">
          Alle taken →
        </Link>
      </div>
      {actief.length > 0 ? (
        <div className="divide-y divide-slate-50">
          {actief.slice(0, 5).map(t => (
            <div key={t.id} className="flex items-center gap-3 px-5 py-3.5">
              <button
                onClick={() => handleToggle(t)}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  t.gedaanVandaag ? 'bg-emerald-500 border-emerald-500' : 'border-slate-200 hover:border-emerald-400'
                }`}
              >
                {t.gedaanVandaag && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </button>
              <span className={`text-sm flex-1 truncate ${t.gedaanVandaag ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>
                {t.titel}
              </span>
              <PrioriteitDot prioriteit={t.prioriteit} />
            </div>
          ))}
          {actief.length > 5 && (
            <div className="px-5 py-3 text-center">
              <Link href="/taken" className="text-xs text-slate-400 hover:text-indigo-600">
                +{actief.length - 5} meer taken
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-slate-400">Geen actieve taken</p>
        </div>
      )}
    </div>
  );
}

function PrioriteitDot({ prioriteit }: { prioriteit?: string }) {
  const map: Record<string, string> = {
    urgent: 'bg-red-500', hoog: 'bg-orange-400', normaal: 'bg-blue-400', laag: 'bg-slate-300',
  };
  return <div className={`w-2 h-2 rounded-full shrink-0 ${map[prioriteit ?? 'normaal'] ?? 'bg-slate-300'}`} />;
}
