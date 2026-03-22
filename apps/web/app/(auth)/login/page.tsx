'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('Onjuist e-mailadres of wachtwoord.');
    } else {
      router.push('/dashboard');
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏥</div>
          <h1 className="text-2xl font-bold text-gray-900">PGB Portaal</h1>
          <p className="text-gray-500 mt-1">Inloggen bij uw zorgomgeving</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mailadres</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="naam@voorbeeld.nl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wachtwoord</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
          >
            {loading ? 'Inloggen...' : 'Inloggen'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Nog geen account?{' '}
          <Link href="/registreer" className="text-indigo-600 font-medium hover:underline">
            Registreer als budgethouder
          </Link>
        </p>
      </div>
    </div>
  );
}
