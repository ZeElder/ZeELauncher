import { supabase } from "../lib/supabase";
import type { UserStatus } from "../types/profile";

export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  seen_at: string | null;
}

export interface PresencePayload {
  userId: string;
  availability: UserStatus;
  onlineAt: string;
  typingTo: string | null;
}

export interface ConversationSidebarItem {
  friendId: string;
  lastMessage: string;
  lastMessageAt: string | null;
  lastMessageIsMine: boolean;
  unreadCount: number;
}

type PresenceMap = Record<string, PresencePayload>;
type SidebarMap = Record<string, ConversationSidebarItem>;

function getRoomId(a: string, b: string) {
  return ["chat", ...[a, b].sort()].join(":");
}

async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error("Utilisateur non connecté.");

  return data.user;
}

function extractPresenceMap(raw: Record<string, PresencePayload[]>) {
  const map: PresenceMap = {};

  Object.values(raw).forEach((entries) => {
    const entry = entries?.[0];
    if (!entry?.userId) return;
    map[entry.userId] = entry;
  });

  return map;
}

export async function getConversation(friendId: string): Promise<ChatMessage[]> {
  const me = await getCurrentUser();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(
      `and(sender_id.eq.${me.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${me.id})`
    )
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []) as ChatMessage[];
}

export async function sendMessage(
  receiverId: string,
  content: string
): Promise<ChatMessage> {
  const me = await getCurrentUser();
  const trimmed = content.trim();

  if (!trimmed) {
    throw new Error("Message vide.");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      sender_id: me.id,
      receiver_id: receiverId,
      content: trimmed,
    })
    .select()
    .single();

  if (error) throw error;

  return data as ChatMessage;
}

export async function markConversationAsSeen(friendId: string): Promise<void> {
  const me = await getCurrentUser();

  const { error } = await supabase
    .from("messages")
    .update({
      seen_at: new Date().toISOString(),
    })
    .eq("sender_id", friendId)
    .eq("receiver_id", me.id)
    .is("seen_at", null);

  if (error) throw error;
}

export async function getUnreadCounts(): Promise<Record<string, number>> {
  const me = await getCurrentUser();

  const { data, error } = await supabase
    .from("messages")
    .select("sender_id")
    .eq("receiver_id", me.id)
    .is("seen_at", null);

  if (error) throw error;

  const counts: Record<string, number> = {};

  for (const row of data ?? []) {
    const senderId = (row as { sender_id: string }).sender_id;
    counts[senderId] = (counts[senderId] ?? 0) + 1;
  }

  return counts;
}

export async function getConversationSidebarState(): Promise<SidebarMap> {
  const me = await getCurrentUser();

  const { data, error } = await supabase
    .from("messages")
    .select("sender_id, receiver_id, content, created_at, seen_at")
    .or(`sender_id.eq.${me.id},receiver_id.eq.${me.id}`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const map: SidebarMap = {};

  for (const row of data ?? []) {
    const message = row as Pick<
      ChatMessage,
      "sender_id" | "receiver_id" | "content" | "created_at" | "seen_at"
    >;

    const friendId =
      message.sender_id === me.id ? message.receiver_id : message.sender_id;

    if (!map[friendId]) {
      map[friendId] = {
        friendId,
        lastMessage: message.content,
        lastMessageAt: message.created_at,
        lastMessageIsMine: message.sender_id === me.id,
        unreadCount: 0,
      };
    }

    if (message.receiver_id === me.id && message.seen_at === null) {
      map[friendId].unreadCount += 1;
    }
  }

  return map;
}

export async function createFriendsPresence(
  availability: UserStatus,
  onSync: (map: PresenceMap) => void
) {
  const me = await getCurrentUser();
  let currentAvailability = availability;

  const channel = supabase.channel("launcher:presence", {
    config: {
      presence: {
        key: me.id,
      },
    },
  });

  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState<PresencePayload>();
    onSync(extractPresenceMap(state));
  });

  channel.subscribe(async (status) => {
    if (status !== "SUBSCRIBED") return;

    await channel.track({
      userId: me.id,
      availability: currentAvailability,
      onlineAt: new Date().toISOString(),
      typingTo: null,
    });
  });

  return {
    async updateAvailability(next: UserStatus) {
      currentAvailability = next;

      await channel.track({
        userId: me.id,
        availability: currentAvailability,
        onlineAt: new Date().toISOString(),
        typingTo: null,
      });
    },

    async destroy() {
      await channel.untrack();
      await supabase.removeChannel(channel);
    },
  };
}

export async function createConversationRealtime(
  friendId: string,
  availability: UserStatus,
  handlers: {
    onMessage: (message: ChatMessage) => void;
    onTypingChange: (isTyping: boolean) => void;
    onSeenUpdate?: (message: ChatMessage) => void;
    onPresenceSync?: (map: PresenceMap) => void;
  }
) {
  const me = await getCurrentUser();
  const roomId = getRoomId(me.id, friendId);
  let currentAvailability = availability;

  const channel = supabase.channel(roomId, {
    config: {
      broadcast: {
        ack: true,
        self: false,
      },
      presence: {
        key: me.id,
      },
    },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresencePayload>();
      handlers.onPresenceSync?.(extractPresenceMap(state));
    })
    .on("broadcast", { event: "typing" }, (payload) => {
      const data = payload.payload as {
        userId?: string;
        typingTo?: string;
        isTyping?: boolean;
      };

      if (data?.userId === friendId && data?.typingTo === me.id) {
        handlers.onTypingChange(Boolean(data.isTyping));
      }
    })
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
      },
      (payload) => {
        const message = payload.new as ChatMessage;

        const isRelated =
          (message.sender_id === me.id && message.receiver_id === friendId) ||
          (message.sender_id === friendId && message.receiver_id === me.id);

        if (isRelated) {
          handlers.onMessage(message);
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
      },
      (payload) => {
        const message = payload.new as ChatMessage;

        const isRelated =
          (message.sender_id === me.id && message.receiver_id === friendId) ||
          (message.sender_id === friendId && message.receiver_id === me.id);

        if (isRelated) {
          handlers.onSeenUpdate?.(message);
        }
      }
    );

  channel.subscribe(async (status) => {
    if (status !== "SUBSCRIBED") return;

    await channel.track({
      userId: me.id,
      availability: currentAvailability,
      onlineAt: new Date().toISOString(),
      typingTo: null,
    });
  });

  return {
    async setTyping(isTyping: boolean) {
      await channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId: me.id,
          typingTo: friendId,
          isTyping,
        },
      });

      await channel.track({
        userId: me.id,
        availability: currentAvailability,
        onlineAt: new Date().toISOString(),
        typingTo: isTyping ? friendId : null,
      });
    },

    async updateAvailability(next: UserStatus) {
      currentAvailability = next;

      await channel.track({
        userId: me.id,
        availability: currentAvailability,
        onlineAt: new Date().toISOString(),
        typingTo: null,
      });
    },

    async destroy() {
      await channel.untrack();
      await supabase.removeChannel(channel);
    },
  };
}

export async function subscribeToIncomingMessages(
  onIncoming: (message: ChatMessage) => void
) {
  const me = await getCurrentUser();

  const channel = supabase.channel(`incoming:${me.id}`);

  channel.on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "messages",
    },
    (payload) => {
      const message = payload.new as ChatMessage;

      if (message.receiver_id === me.id) {
        onIncoming(message);
      }
    }
  );

  channel.subscribe();

  return async () => {
    await supabase.removeChannel(channel);
  };
}