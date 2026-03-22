'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/planning', label: 'Planning', icon: '📅' },
  { href: '/taken', label: 'Taken', icon: '✅' },
  { href: '/chat', label: 'Chat', icon: '💬' },
  { href: '/team', label: 'Team', icon: '👥' },
];

export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏥</span>
          <div>
            <p className="font-bold text-gray-900 text-sm">PGB Portaal</p>
            <p className="text-xs text-gray-400">Zorgbeheer</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
            {user.email?.[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">{user.email}</p>
            <p className="text-xs text-gray-400">Beheerder</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <span>🚪</span> Uitloggen
        </button>
      </div>
    </aside>
  );
}
