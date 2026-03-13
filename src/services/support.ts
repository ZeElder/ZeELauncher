import { supabase } from "../lib/supabase";

export const SUPPORT_ADMIN_USER_ID = "48c344ca-0f99-436a-a55b-9d6d0e67f2eb";

export type SupportTicketType = "support" | "suggestion";
export type SupportTicketStatus = "open" | "in_progress" | "closed";

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  type: SupportTicketType;
  status: SupportTicketStatus;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface SupportTicketWithMeta extends SupportTicket {
  last_message_at: string | null;
  last_message_sender_id: string | null;
  last_message_preview: string | null;
  unread: boolean;
}

async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error("Utilisateur non connecté.");

  return data.user;
}

function getReadMapKey(userId: string) {
  return `zeelauncher_support_reads_${userId}`;
}

function readViewedMap(userId: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(getReadMapKey(userId));
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeViewedMap(userId: string, map: Record<string, string>) {
  window.localStorage.setItem(getReadMapKey(userId), JSON.stringify(map));
}

export async function markSupportTicketViewed(ticketId: string) {
  const user = await getCurrentUser();
  const current = readViewedMap(user.id);

  current[ticketId] = new Date().toISOString();
  writeViewedMap(user.id, current);
}

export async function isSupportAdmin() {
  const user = await getCurrentUser();
  return user.id === SUPPORT_ADMIN_USER_ID;
}

export async function getMySupportUserId() {
  const user = await getCurrentUser();
  return user.id;
}

export async function createSupportTicket(payload: {
  subject: string;
  type: SupportTicketType;
  content: string;
}) {
  const user = await getCurrentUser();

  const subject = payload.subject.trim();
  const content = payload.content.trim();

  if (!subject) {
    throw new Error("Sujet requis.");
  }

  if (!content) {
    throw new Error("Message requis.");
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      subject,
      type: payload.type,
      status: "open",
    })
    .select()
    .single();

  if (ticketError) throw ticketError;

  const { error: messageError } = await supabase
    .from("support_ticket_messages")
    .insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      content,
    });

  if (messageError) throw messageError;

  return ticket as SupportTicket;
}

async function hydrateTickets(
  tickets: SupportTicket[],
  currentUserId: string
): Promise<SupportTicketWithMeta[]> {
  if (tickets.length === 0) {
    return [];
  }

  const viewedMap = readViewedMap(currentUserId);
  const ticketIds = tickets.map((ticket) => ticket.id);

  const { data: messageRows, error } = await supabase
    .from("support_ticket_messages")
    .select("ticket_id, sender_id, content, created_at")
    .in("ticket_id", ticketIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const latestByTicket = new Map<
    string,
    {
      sender_id: string;
      content: string;
      created_at: string;
    }
  >();

  for (const row of messageRows ?? []) {
    const ticketId = (row as { ticket_id: string }).ticket_id;

    if (!latestByTicket.has(ticketId)) {
      latestByTicket.set(ticketId, {
        sender_id: (row as { sender_id: string }).sender_id,
        content: (row as { content: string }).content,
        created_at: (row as { created_at: string }).created_at,
      });
    }
  }

  return tickets.map((ticket) => {
    const latest = latestByTicket.get(ticket.id);
    const viewedAt = viewedMap[ticket.id];
    const lastMessageAt = latest?.created_at ?? null;
    const lastMessageSenderId = latest?.sender_id ?? null;

    const unread =
      ticket.status !== "closed" &&
      !!lastMessageAt &&
      lastMessageSenderId !== currentUserId &&
      (!viewedAt ||
        new Date(lastMessageAt).getTime() > new Date(viewedAt).getTime());

    return {
      ...ticket,
      last_message_at: lastMessageAt,
      last_message_sender_id: lastMessageSenderId,
      last_message_preview: latest?.content ?? null,
      unread,
    };
  });
}

export async function getSupportTickets(): Promise<SupportTicketWithMeta[]> {
  const user = await getCurrentUser();
  const admin = user.id === SUPPORT_ADMIN_USER_ID;

  let query = supabase
    .from("support_tickets")
    .select("*")
    .order("updated_at", { ascending: false });

  if (!admin) {
    query = query.eq("user_id", user.id);
  }

  const { data, error } = await query;

  if (error) throw error;

  return hydrateTickets((data ?? []) as SupportTicket[], user.id);
}

export async function getSupportUnreadCount(): Promise<number> {
  const tickets = await getSupportTickets();
  return tickets.filter((ticket) => ticket.unread).length;
}

export async function getSupportTicketMessages(
  ticketId: string
): Promise<SupportTicketMessage[]> {
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []) as SupportTicketMessage[];
}

export async function sendSupportTicketMessage(
  ticketId: string,
  content: string
) {
  const user = await getCurrentUser();
  const trimmed = content.trim();

  if (!trimmed) {
    throw new Error("Message vide.");
  }

  const { data, error } = await supabase
    .from("support_ticket_messages")
    .insert({
      ticket_id: ticketId,
      sender_id: user.id,
      content: trimmed,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from("support_tickets")
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  await markSupportTicketViewed(ticketId);

  return data as SupportTicketMessage;
}

export async function updateSupportTicketStatus(
  ticketId: string,
  status: SupportTicketStatus
) {
  const admin = await isSupportAdmin();

  if (!admin) {
    throw new Error("Accès refusé.");
  }

  const { data, error } = await supabase
    .from("support_tickets")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId)
    .select()
    .single();

  if (error) throw error;

  return data as SupportTicket;
}

export async function deleteSupportTicket(ticketId: string) {
  const admin = await isSupportAdmin();

  if (!admin) {
    throw new Error("Accès refusé.");
  }

  const { error } = await supabase
    .from("support_tickets")
    .delete()
    .eq("id", ticketId);

  if (error) throw error;
}

export async function subscribeToSupportTicketsRealtime(
  onChange: () => void
) {
  const channel = supabase.channel("support-tickets-realtime");

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "support_tickets",
    },
    () => {
      onChange();
    }
  );

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "support_ticket_messages",
    },
    () => {
      onChange();
    }
  );

  channel.subscribe();

  return async () => {
    await supabase.removeChannel(channel);
  };
}