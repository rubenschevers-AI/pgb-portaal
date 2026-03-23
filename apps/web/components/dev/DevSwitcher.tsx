'use client';

import { useState } from 'react';
import { devSwitchAction } from '@/app/actions/dev-switch';

type TestAccount = {
  id: string;
  label: string;
  email: string;
  rol: string;
};

export default function DevSwitcher({ accounts }: { accounts: TestAccount[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSwitch = async (account: TestAccount) => {
    setLoading(account.id);
    setErrorMsg(null);

    const result = await devSwitchAction(account.email);

    if ('error' in result) {
      setLoading(null);
      setErrorMsg(`Inloggen mislukt: ${result.error}`);
      return;
    }

    // Session is set server-side — hard navigate to dashboard
    window.location.replace('/dashboard');
  };

  if (accounts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 z-50">
      {open && (
        <div className="mb-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden w-64">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Dev · Account wisselen</p>
          </div>
          {errorMsg && (
            <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-600">
              {errorMsg}
            </div>
          )}
          <div className="py-1">
            {accounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => handleSwitch(acc)}
                disabled={!!loading}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition text-left disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0">
                  {acc.label[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{acc.label}</p>
                  <p className="text-xs text-slate-400">{acc.rol}</p>
                </div>
                {loading === acc.id && (
                  <div className="ml-auto w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => { setOpen(v => !v); setErrorMsg(null); }}
        className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center shadow-lg hover:bg-slate-700 transition text-sm font-bold"
        title="Dev: account wisselen"
      >
        {open ? '×' : '⚙'}
      </button>
    </div>
  );
}
