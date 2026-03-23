'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

type NavGroup = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  routes: string[];
};

const NAV_BEHEERDER: NavGroup[] = [
  { href: '/dashboard',     label: 'Dashboard',  icon: IconDashboard, routes: ['/dashboard'] },
  { href: '/planning',      label: 'Rooster',    icon: IconPlanning,  routes: ['/planning', '/basisrooster', '/open-diensten'] },
  { href: '/taken',         label: 'Taken',      icon: IconTaken,     routes: ['/taken'] },
  { href: '/metingen',      label: 'Gezondheid', icon: IconMetingen,  routes: ['/metingen', '/medicatie'] },
  { href: '/chat',          label: 'Chat',       icon: IconChat,      routes: ['/chat'] },
  { href: '/uren',          label: 'Financiën',  icon: IconBudget,    routes: ['/uren', '/budget'] },
  { href: '/team',          label: 'Team',       icon: IconTeam,      routes: ['/team', '/client'] },
];

const NAV_ZORGVERLENER: NavGroup[] = [
  { href: '/dashboard',     label: 'Dashboard',  icon: IconDashboard, routes: ['/dashboard'] },
  { href: '/open-diensten', label: 'Rooster',    icon: IconPlanning,  routes: ['/planning', '/open-diensten'] },
  { href: '/taken',         label: 'Taken',      icon: IconTaken,     routes: ['/taken'] },
  { href: '/metingen',      label: 'Gezondheid', icon: IconMetingen,  routes: ['/metingen', '/medicatie'] },
  { href: '/chat',          label: 'Chat',       icon: IconChat,      routes: ['/chat'] },
  { href: '/uren',          label: 'Uren',       icon: IconBudget,    routes: ['/uren'] },
  { href: '/client',        label: 'Cliënt',     icon: IconTeam,      routes: ['/client'] },
];

export default function Sidebar({
  user,
  displayNaam,
  isBeheerder = true,
}: {
  user: User;
  displayNaam?: string | null;
  isBeheerder?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [meerOpen, setMeerOpen] = useState(false);

  const NAV = isBeheerder ? NAV_BEHEERDER : NAV_ZORGVERLENER;
  const MOBILE_MAIN = NAV.slice(0, 4);
  const MOBILE_MEER = NAV.slice(4);

  const isActive = (group: NavGroup) =>
    group.routes.some((r) => pathname.startsWith(r));

  const meerActive = MOBILE_MEER.some((g) => isActive(g));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const initiaal = displayNaam
    ? displayNaam[0].toUpperCase()
    : (user.email?.[0] ?? '?').toUpperCase();

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="hidden md:flex w-56 lg:w-60 flex-col bg-white border-r border-slate-100 h-full shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l7.5-7.5 7.5 7.5m-15 6l7.5-7.5 7.5 7.5" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm leading-tight">PGB Portaal</p>
              <p className="text-xs text-slate-400 leading-tight">Zorgbeheer</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map((group) => {
            const active = isActive(group);
            const Icon = group.icon;
            return (
              <Link
                key={group.href}
                href={group.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                {group.label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-slate-100 space-y-0.5">
          <Link
            href="/profiel"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
              pathname.startsWith('/profiel') ? 'bg-indigo-50' : 'hover:bg-slate-50'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0">
              {initiaal}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{displayNaam ?? user.email}</p>
              <p className="text-xs text-slate-400">Mijn profiel</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
          >
            <IconLogout className="w-[18px] h-[18px] shrink-0" />
            Uitloggen
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom nav ───────────────────────────── */}
      {/* Meer overlay */}
      {meerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/20"
          onClick={() => setMeerOpen(false)}
        >
          <div
            className="absolute bottom-16 right-0 left-0 bg-white border-t border-slate-100 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-2 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Meer</p>
            </div>
            <div className="py-1">
              {MOBILE_MEER.map((group) => {
                const active = isActive(group);
                const Icon = group.icon;
                return (
                  <Link
                    key={group.href}
                    href={group.href}
                    onClick={() => setMeerOpen(false)}
                    className={`flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors ${
                      active ? 'text-indigo-700 bg-indigo-50' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                    {group.label}
                  </Link>
                );
              })}
              <Link
                href="/profiel"
                onClick={() => setMeerOpen(false)}
                className={`flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors ${
                  pathname.startsWith('/profiel') ? 'text-indigo-700 bg-indigo-50' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <IconProfiel className="w-5 h-5 text-slate-400" />
                Profiel
              </Link>
            </div>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-100 flex safe-area-pb">
        {MOBILE_MAIN.map((group) => {
          const active = isActive(group);
          const Icon = group.icon;
          return (
            <Link
              key={group.href}
              href={group.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                active ? 'text-indigo-600' : 'text-slate-400'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>{group.label}</span>
            </Link>
          );
        })}
        {/* Meer button */}
        <button
          onClick={() => setMeerOpen((v) => !v)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
            meerActive || meerOpen ? 'text-indigo-600' : 'text-slate-400'
          }`}
        >
          <IconMeer className={`w-5 h-5 ${meerActive || meerOpen ? 'text-indigo-600' : 'text-slate-400'}`} />
          <span>Meer</span>
        </button>
      </nav>
    </>
  );
}

/* ── SVG icon components ─────────────────────────────────── */
function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}
function IconPlanning({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function IconTaken({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function IconChat({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}
function IconTeam({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
function IconMetingen({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h2l3-8 4 16 3-8h2" />
    </svg>
  );
}
function IconBudget({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-4-6h8M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function IconProfiel({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
function IconMeer({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01" />
    </svg>
  );
}
function IconLogout({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
