'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

/* ── Types ────────────────────────────────────────────────── */
type Message = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  conversation_id: string;
};

type ConvSummary = {
  id: string;
  name: string | null;
  type: 'group' | 'direct';
  created_at: string;
  lastMessage: Omit<Message, 'conversation_id'> & { conversation_id: string } | null;
  memberIds: string[];
};

type TeamLid = { userId: string; naam: string; rol: string };

type Props = {
  user: User;
  ownerId: string;
  eigenNaam: string;
  initialConversations: ConvSummary[];
  team: TeamLid[];
  profileMap: Record<string, string>;
};

/* ── Main component ───────────────────────────────────────── */
export default function ChatClient({
  user,
  ownerId,
  eigenNaam,
  initialConversations,
  team,
  profileMap: initProfileMap,
}: Props) {
  const supabase = createClient();

  const [convs, setConvs] = useState<ConvSummary[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversations[0]?.id ?? null);
  const [msgsByConv, setMsgsByConv] = useState<Record<string, Message[]>>({});
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [showNieuw, setShowNieuw] = useState(false);
  const [profileMap, setProfileMap] = useState<Record<string, string>>(initProfileMap);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ── Load messages when conversation selected ─────────── */
  useEffect(() => {
    if (!selectedId || msgsByConv[selectedId] !== undefined) return;
    loadMessages(selectedId);
  }, [selectedId]);

  const loadMessages = async (convId: string) => {
    setLoadingMsgs(true);
    const { data } = await supabase
      .from('messages')
      .select('id, body, created_at, sender_id, conversation_id')
      .eq('conversation_id', convId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(200);
    setMsgsByConv(prev => ({ ...prev, [convId]: data ?? [] }));
    setLoadingMsgs(false);
  };

  /* ── Scroll to bottom ─────────────────────────────────── */
  useEffect(() => {
    if (!selectedId) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgsByConv[selectedId ?? '']?.length]);

  /* ── Realtime subscription ────────────────────────────── */
  useEffect(() => {
    const channel = supabase
      .channel('chat-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `owner_id=eq.${ownerId}` },
        async (payload) => {
          const msg = payload.new as Message;

          // Resolve sender name if unknown
          if (!profileMap[msg.sender_id]) {
            const { data: p } = await supabase
              .from('profiles')
              .select('user_id, voornaam, achternaam')
              .eq('user_id', msg.sender_id)
              .single();
            if (p) {
              const naam = [p.voornaam, p.achternaam].filter(Boolean).join(' ') || 'Teamlid';
              setProfileMap(prev => ({ ...prev, [msg.sender_id]: naam }));
            }
          }

          // Add to messages list if loaded
          setMsgsByConv(prev => {
            if (prev[msg.conversation_id] === undefined) return prev;
            if (prev[msg.conversation_id].some(m => m.id === msg.id)) return prev;
            return { ...prev, [msg.conversation_id]: [...prev[msg.conversation_id], msg] };
          });

          // Update last message in conv list + re-sort
          setConvs(prev =>
            [...prev.map(c =>
              c.id === msg.conversation_id ? { ...c, lastMessage: msg } : c
            )].sort((a, b) => {
              const ta = a.lastMessage?.created_at ?? a.created_at;
              const tb = b.lastMessage?.created_at ?? b.created_at;
              return tb.localeCompare(ta);
            })
          );
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [ownerId]);

  /* ── Send message ─────────────────────────────────────── */
  const handleVerstuur = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || sending || !selectedId) return;
    setSending(true);
    const body = input.trim();
    setInput('');

    // Optimistic
    const optId = `opt-${Date.now()}`;
    const optMsg: Message = { id: optId, body, created_at: new Date().toISOString(), sender_id: user.id, conversation_id: selectedId };
    setMsgsByConv(prev => ({ ...prev, [selectedId]: [...(prev[selectedId] ?? []), optMsg] }));

    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: selectedId, sender_id: user.id, owner_id: ownerId, body })
      .select('id, body, created_at, sender_id, conversation_id')
      .single();

    if (!error && data) {
      setMsgsByConv(prev => ({
        ...prev,
        [selectedId]: (prev[selectedId] ?? []).map(m => m.id === optId ? (data as Message) : m),
      }));
    } else {
      setMsgsByConv(prev => ({
        ...prev,
        [selectedId]: (prev[selectedId] ?? []).filter(m => m.id !== optId),
      }));
      setInput(body);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleVerstuur();
    }
  };

  /* ── Create new conversation ──────────────────────────── */
  const handleNieuwGesprek = async (memberIds: string[], isGroup: boolean) => {
    const allMemberIds = [user.id, ...memberIds];

    // For direct: check if already exists
    if (!isGroup && memberIds.length === 1) {
      const existing = convs.find(c =>
        c.type === 'direct' &&
        memberIds[0] &&
        c.memberIds.includes(user.id) &&
        c.memberIds.includes(memberIds[0])
      );
      if (existing) {
        setSelectedId(existing.id);
        setShowNieuw(false);
        setMobileView('chat');
        return;
      }
    }

    const convName = isGroup
      ? `Groep: ${[eigenNaam, ...memberIds.map(id => profileMap[id] ?? 'Teamlid')].join(', ')}`
      : null;

    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({ owner_id: ownerId, name: convName, type: isGroup ? 'group' : 'direct' })
      .select('id, name, type, created_at')
      .single();

    if (error || !newConv) return;

    // Insert members
    await supabase.from('conversation_members').insert(
      allMemberIds.map(uid => ({ conversation_id: newConv.id, user_id: uid }))
    );

    const conv: ConvSummary = {
      id: newConv.id,
      name: newConv.name,
      type: newConv.type as 'group' | 'direct',
      created_at: newConv.created_at,
      lastMessage: null,
      memberIds: allMemberIds,
    };
    setConvs(prev => [conv, ...prev]);
    setSelectedId(newConv.id);
    setMsgsByConv(prev => ({ ...prev, [newConv.id]: [] }));
    setShowNieuw(false);
    setMobileView('chat');
  };

  /* ── Helpers ──────────────────────────────────────────── */
  const getConvNaam = useCallback((conv: ConvSummary): string => {
    if (conv.type === 'group') return conv.name ?? 'Teamchat';
    const otherId = conv.memberIds.find(id => id !== user.id);
    return otherId ? (profileMap[otherId] ?? 'Direct gesprek') : 'Direct gesprek';
  }, [profileMap, user.id]);

  const getConvInitiaal = (conv: ConvSummary): string => getConvNaam(conv)[0]?.toUpperCase() ?? '?';

  const getNaam = (senderId: string): string =>
    senderId === user.id ? eigenNaam : (profileMap[senderId] ?? 'Teamlid');

  const formatTijd = (iso: string) =>
    new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

  const formatDatum = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
    const gisteren = new Date(vandaag); gisteren.setDate(gisteren.getDate() - 1);
    if (d.getTime() === vandaag.getTime()) return 'Vandaag';
    if (d.getTime() === gisteren.getTime()) return 'Gisteren';
    return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const formatLastMsgTime = (iso: string) => {
    const d = new Date(iso);
    const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
    if (d >= vandaag) return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    const gisteren = new Date(vandaag); gisteren.setDate(gisteren.getDate() - 1);
    if (d >= gisteren) return 'gisteren';
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  };

  const selectedConv = convs.find(c => c.id === selectedId) ?? null;
  const currentMessages = selectedId ? (msgsByConv[selectedId] ?? null) : null;

  // Group messages by date
  type Item =
    | { type: 'date'; datum: string }
    | { type: 'msg'; msg: Message; isFirst: boolean; isLast: boolean };

  const buildItems = (msgs: Message[]): Item[] => {
    const items: Item[] = [];
    let prevDate = '';
    let prevSender = '';
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      const next = msgs[i + 1];
      const datum = msg.created_at.split('T')[0];
      if (datum !== prevDate) {
        items.push({ type: 'date', datum });
        prevDate = datum;
        prevSender = '';
      }
      const isFirst = msg.sender_id !== prevSender;
      const isLast = !next || next.sender_id !== msg.sender_id || next.created_at.split('T')[0] !== datum;
      items.push({ type: 'msg', msg, isFirst, isLast });
      prevSender = msg.sender_id;
    }
    return items;
  };

  /* ── Conversation list panel ──────────────────────────── */
  const ConvList = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between bg-white flex-shrink-0">
        <h1 className="font-bold text-slate-900">Berichten</h1>
        <button
          onClick={() => setShowNieuw(true)}
          className="w-8 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center transition"
          title="Nieuw gesprek"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {convs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 px-6 text-center">
            <svg className="w-12 h-12 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm">Nog geen gesprekken. Klik op + om te beginnen.</p>
          </div>
        ) : (
          convs.map(conv => {
            const isSelected = conv.id === selectedId;
            const naam = getConvNaam(conv);
            const isGroup = conv.type === 'group';
            return (
              <button
                key={conv.id}
                onClick={() => {
                  setSelectedId(conv.id);
                  setMobileView('chat');
                }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 transition text-left border-b border-slate-50 ${
                  isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                }`}
              >
                {/* Avatar */}
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0 ${
                  isGroup ? 'bg-indigo-600 text-white' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {isGroup
                    ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    : naam[0]?.toUpperCase()
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-1">
                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-indigo-700' : 'text-slate-800'}`}>
                      {naam}
                    </p>
                    {conv.lastMessage && (
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatLastMsgTime(conv.lastMessage.created_at)}
                      </span>
                    )}
                  </div>
                  {conv.lastMessage ? (
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {conv.lastMessage.sender_id === user.id ? 'Jij: ' : ''}
                      {conv.lastMessage.body}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-300 mt-0.5 italic">Nog geen berichten</p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  /* ── Message view panel ───────────────────────────────── */
  const MessagePanel = (
    <div className="flex flex-col h-full bg-slate-50">
      {selectedConv ? (
        <>
          {/* Header */}
          <div className="bg-white border-b border-slate-100 px-4 py-3.5 flex items-center gap-3 flex-shrink-0">
            {/* Mobile back button */}
            <button
              onClick={() => setMobileView('list')}
              className="md:hidden w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition -ml-1 mr-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              selectedConv.type === 'group' ? 'bg-indigo-600' : 'bg-emerald-100'
            }`}>
              {selectedConv.type === 'group'
                ? <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                : <span className="text-xs font-bold text-emerald-700">{getConvNaam(selectedConv)[0]?.toUpperCase()}</span>
              }
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-slate-900 text-sm leading-tight">{getConvNaam(selectedConv)}</h2>
              <p className="text-xs text-slate-400 leading-tight">
                {selectedConv.type === 'group'
                  ? `${selectedConv.memberIds.length} deelnemer${selectedConv.memberIds.length !== 1 ? 's' : ''}`
                  : 'Direct gesprek'
                }
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {loadingMsgs ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              </div>
            ) : currentMessages !== null && currentMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="font-semibold text-slate-700 text-sm">Begin het gesprek</p>
                  <p className="text-xs text-slate-400 mt-1">Stuur het eerste bericht</p>
                </div>
              </div>
            ) : (
              <div className="space-y-0.5 max-w-3xl mx-auto">
                {buildItems(currentMessages ?? []).map((item, i) => {
                  if (item.type === 'date') {
                    return (
                      <div key={`d${i}`} className="flex items-center gap-3 py-4">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-xs text-slate-400 font-medium bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                          {formatDatum(item.datum)}
                        </span>
                        <div className="flex-1 h-px bg-slate-200" />
                      </div>
                    );
                  }
                  const { msg, isFirst, isLast } = item;
                  const eigen = msg.sender_id === user.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${eigen ? 'flex-row-reverse' : 'flex-row'} ${isFirst ? 'mt-3' : 'mt-0.5'}`}
                    >
                      {!eigen && (
                        <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold ${
                          isLast ? 'bg-emerald-100 text-emerald-700' : 'opacity-0 pointer-events-none'
                        }`}>
                          {getNaam(msg.sender_id)[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className={`flex flex-col gap-0.5 max-w-[72%] md:max-w-[60%] ${eigen ? 'items-end' : 'items-start'}`}>
                        {isFirst && !eigen && (
                          <span className="text-xs font-semibold text-slate-500 px-1">{getNaam(msg.sender_id)}</span>
                        )}
                        <div className={`px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                          eigen
                            ? `bg-indigo-600 text-white ${isFirst ? 'rounded-2xl rounded-br-md' : isLast ? 'rounded-2xl rounded-tr-md' : 'rounded-xl rounded-r-md'}`
                            : `bg-white border border-slate-100 text-slate-800 shadow-sm ${isFirst ? 'rounded-2xl rounded-bl-md' : isLast ? 'rounded-2xl rounded-tl-md' : 'rounded-xl rounded-l-md'}`
                        }`}>
                          {msg.body}
                        </div>
                        {isLast && (
                          <span className="text-[10px] px-1 text-slate-400">{formatTijd(msg.created_at)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div ref={bottomRef} className="h-1" />
          </div>

          {/* Input */}
          <div className="bg-white border-t border-slate-100 px-4 py-3 flex-shrink-0">
            <form onSubmit={handleVerstuur} className="flex items-end gap-2 max-w-3xl mx-auto">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Stuur een bericht... (Enter = verstuur)"
                rows={1}
                className="flex-1 px-4 py-2.5 bg-slate-100 border border-transparent rounded-2xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-200 transition resize-none leading-relaxed"
                style={{ minHeight: '42px', maxHeight: '120px' }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                }}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </form>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-slate-400">
          <div className="text-center">
            <svg className="w-16 h-16 text-slate-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm font-medium">Selecteer een gesprek</p>
          </div>
        </div>
      )}
    </div>
  );

  /* ── Nieuw gesprek modal ───────────────────────────────── */
  const NieuwModal = showNieuw && (
    <NieuwGesprekModal
      team={team}
      profileMap={profileMap}
      userId={user.id}
      onClose={() => setShowNieuw(false)}
      onCreate={handleNieuwGesprek}
    />
  );

  /* ── Layout ───────────────────────────────────────────── */
  return (
    <div className="flex h-full">
      {/* Desktop: left panel always visible */}
      <div className={`
        w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-slate-100 bg-white
        md:flex flex-col
        ${mobileView === 'list' ? 'flex' : 'hidden'}
      `}>
        {ConvList}
      </div>

      {/* Right: message view */}
      <div className={`
        flex-1 flex flex-col min-w-0
        ${mobileView === 'chat' ? 'flex' : 'hidden md:flex'}
      `}>
        {MessagePanel}
      </div>

      {NieuwModal}
    </div>
  );
}

/* ── Nieuw gesprek modal component ────────────────────────── */
function NieuwGesprekModal({
  team,
  profileMap,
  userId,
  onClose,
  onCreate,
}: {
  team: TeamLid[];
  profileMap: Record<string, string>;
  userId: string;
  onClose: () => void;
  onCreate: (memberIds: string[], isGroup: boolean) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const toggle = (uid: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const handleCreate = async () => {
    if (selected.size === 0) return;
    setCreating(true);
    await onCreate([...selected], selected.size > 1);
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Nieuw gesprek</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl text-slate-400 hover:bg-slate-100 flex items-center justify-center transition text-lg">×</button>
        </div>

        <div className="px-3 py-2 max-h-72 overflow-y-auto">
          {team.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Geen teamleden gevonden.</p>
          ) : (
            team.map(lid => {
              const isSelected = selected.has(lid.userId);
              return (
                <button
                  key={lid.userId}
                  onClick={() => toggle(lid.userId)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition mb-0.5 ${
                    isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {lid.naam[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-slate-800">{lid.naam}</p>
                    <p className="text-xs text-slate-400">{lid.rol}</p>
                  </div>
                  {isSelected && (
                    <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100">
          <button
            onClick={handleCreate}
            disabled={selected.size === 0 || creating}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            {creating ? (
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <>
                {selected.size === 0 ? 'Selecteer deelnemers' : selected.size === 1 ? '1:1 gesprek starten' : `Groepsgesprek starten (${selected.size + 1})`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
