import { createClient } from '@/lib/supabase/server';
import ChatClient from '@/components/chat/ChatClient';

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get owner ID for this user (budgethouder's ID, works for team members too via my_owner_id())
  const { data: ownerIdData } = await supabase.rpc('my_owner_id');
  const ownerId = (ownerIdData as string) ?? user!.id;

  // Fetch all conversations accessible to this user
  const { data: convRows } = await supabase
    .from('conversations')
    .select('id, name, type, created_at')
    .order('created_at', { ascending: false });

  const convIds = (convRows ?? []).map(c => c.id);

  // Fetch conversation members + last messages in parallel
  const [
    { data: memberRows },
    { data: recentMsgs },
    { data: teamRows },
    { data: profileRows },
  ] = await Promise.all([
    convIds.length > 0
      ? supabase.from('conversation_members').select('conversation_id, user_id').in('conversation_id', convIds)
      : Promise.resolve({ data: [] }),
    convIds.length > 0
      ? supabase.from('messages')
          .select('id, conversation_id, body, created_at, sender_id')
          .in('conversation_id', convIds)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] }),
    supabase.from('team_members')
      .select('member_user_id, naam, rol')
      .eq('status', 'actief')
      .not('member_user_id', 'is', null),
    supabase.from('profiles').select('user_id, voornaam, achternaam').eq('user_id', user!.id).single(),
  ]);

  // Build last message per conversation
  const lastMsgMap: Record<string, { id: string; conversation_id: string; body: string; created_at: string; sender_id: string }> = {};
  for (const msg of recentMsgs ?? []) {
    if (!lastMsgMap[msg.conversation_id]) lastMsgMap[msg.conversation_id] = msg;
  }

  // Build member list per conversation
  const memberMap: Record<string, string[]> = {};
  for (const m of memberRows ?? []) {
    if (!memberMap[m.conversation_id]) memberMap[m.conversation_id] = [];
    memberMap[m.conversation_id].push(m.user_id);
  }

  // Build profile map: user_id → display name
  const profileMap: Record<string, string> = {};
  // Budgethouder profile
  if (profileRows) {
    profileMap[user!.id] = [profileRows.voornaam, profileRows.achternaam].filter(Boolean).join(' ') || (user!.email?.split('@')[0] ?? 'Jij');
  }
  // Team members
  for (const t of teamRows ?? []) {
    if (t.member_user_id) profileMap[t.member_user_id] = t.naam;
  }

  // Build conversations with last message + sorted by activity
  const conversations = (convRows ?? [])
    .map(c => ({
      id: c.id,
      name: c.name as string | null,
      type: c.type as 'group' | 'direct',
      created_at: c.created_at as string,
      lastMessage: lastMsgMap[c.id] ?? null,
      memberIds: memberMap[c.id] ?? [],
    }))
    .sort((a, b) => {
      const ta = a.lastMessage?.created_at ?? a.created_at;
      const tb = b.lastMessage?.created_at ?? b.created_at;
      return tb.localeCompare(ta);
    });

  // Team for "nieuw gesprek" modal
  const team = (teamRows ?? [])
    .filter(t => t.member_user_id)
    .map(t => ({ userId: t.member_user_id as string, naam: t.naam, rol: t.rol }));

  return (
    <ChatClient
      user={user!}
      ownerId={ownerId}
      eigenNaam={profileMap[user!.id] ?? 'Jij'}
      initialConversations={conversations}
      team={team}
      profileMap={profileMap}
    />
  );
}
