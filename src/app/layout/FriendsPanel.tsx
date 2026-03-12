import { useEffect, useMemo, useRef, useState } from "react";
import {
  acceptFriendRequest,
  getFriendsList,
  getIncomingFriendRequests,
  rejectFriendRequest,
  removeFriendRequestOrFriend,
  searchProfiles,
  sendFriendRequest,
} from "../../services/friends";
import {
  createConversationRealtime,
  getConversation,
  getConversationSidebarState,
  markConversationAsSeen,
  sendMessage,
  type ChatMessage,
  type ConversationSidebarItem,
  type PresencePayload,
} from "../../services/chat";
import type { UserStatus } from "../../types/profile";

type Props = {
  open: boolean;
  onClose: () => void;
  presenceMap: Record<string, PresencePayload>;
  myAvailability: UserStatus;
  unreadCounts: Record<string, number>;
  onUnreadCountsChange?: (next: Record<string, number>) => void;
  onActiveConversationChange?: (friendId: string | null) => void;
};

type FriendLike = {
  requestId: string;
  userId: string;
  username: string;
  avatar_url: string;
  status: UserStatus;
  bio: string;
};

const EMOJIS = ["😀", "😂", "😎", "🥶", "😭", "❤️", "🔥", "🎮", "👀", "👍", "🚀", "💀"];

function getStatusDotClass(status: UserStatus) {
  switch (status) {
    case "En ligne":
      return "bg-green-400";
    case "Inactive":
      return "bg-amber-400";
    case "Hors ligne":
      return "bg-zinc-500";
  }
}

function sortFriends<
  T extends {
    username: string;
    userId: string;
    previewAt: string | null;
    unreadCount: number;
  }
>(items: T[]) {
  return [...items].sort((a, b) => {
    if (a.unreadCount !== b.unreadCount) {
      return b.unreadCount - a.unreadCount;
    }

    const aTime = a.previewAt ? new Date(a.previewAt).getTime() : 0;
    const bTime = b.previewAt ? new Date(b.previewAt).getTime() : 0;

    if (aTime !== bTime) {
      return bTime - aTime;
    }

    return a.username.localeCompare(b.username, "fr");
  });
}

function formatPreview(meta?: ConversationSidebarItem) {
  if (!meta?.lastMessage) return null;
  const prefix = meta.lastMessageIsMine ? "Vous : " : "";
  return `${prefix}${meta.lastMessage}`;
}

export default function FriendsPanel({
  open,
  onClose,
  presenceMap,
  myAvailability,
  unreadCounts,
  onUnreadCountsChange,
  onActiveConversationChange,
}: Props) {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<FriendLike[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<FriendLike | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sidebarState, setSidebarState] = useState<
    Record<string, ConversationSidebarItem>
  >({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const conversationControllerRef = useRef<{
    setTyping: (isTyping: boolean) => Promise<void>;
    updateAvailability: (next: UserStatus) => Promise<void>;
    destroy: () => Promise<void>;
  } | null>(null);

  const liveFriends = useMemo(() => {
    return friends.map((friend) => {
      const live = presenceMap[friend.userId];
      const meta = sidebarState[friend.userId];

      return {
        ...friend,
        liveStatus: live ? live.availability : ("Hors ligne" as UserStatus),
        unreadCount: unreadCounts[friend.userId] ?? 0,
        preview: formatPreview(meta),
        previewAt: meta?.lastMessageAt ?? null,
      };
    });
  }, [friends, presenceMap, unreadCounts, sidebarState]);

  const onlineFriends = useMemo(
    () =>
      sortFriends(
        liveFriends.filter(
          (friend) =>
            friend.liveStatus === "En ligne" || friend.liveStatus === "Inactive"
        )
      ),
    [liveFriends]
  );

  const offlineFriends = useMemo(
    () =>
      sortFriends(
        liveFriends.filter((friend) => friend.liveStatus === "Hors ligne")
      ),
    [liveFriends]
  );

  const selectedFriendLiveStatus = useMemo(() => {
    if (!selectedFriend) return "Hors ligne" as UserStatus;
    const live = presenceMap[selectedFriend.userId];
    return live ? live.availability : ("Hors ligne" as UserStatus);
  }, [selectedFriend, presenceMap]);

  useEffect(() => {
    onActiveConversationChange?.(
      open && selectedFriend ? selectedFriend.userId : null
    );
  }, [open, selectedFriend, onActiveConversationChange]);

  const loadPanelData = async () => {
    try {
      setMessage(null);

      const [friendsData, requestsData, sidebarData] = await Promise.all([
        getFriendsList(),
        getIncomingFriendRequests(),
        getConversationSidebarState(),
      ]);

      setFriends(friendsData);
      setRequests(requestsData);
      setSidebarState(sidebarData);

      if (selectedFriend) {
        const refreshed =
          friendsData.find((friend) => friend.userId === selectedFriend.userId) ??
          null;
        setSelectedFriend(refreshed);
      }
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Erreur chargement amis.");
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadPanelData();
  }, [open]);

  useEffect(() => {
    if (!selectedFriend || !open) {
      setMessages([]);
      setTyping(false);
      void conversationControllerRef.current?.destroy();
      conversationControllerRef.current = null;
      return;
    }

    let active = true;

    const bootConversation = async () => {
      try {
        setTyping(false);
        setMessages([]);

        const initialMessages = await getConversation(selectedFriend.userId);

        if (!active) return;
        setMessages(initialMessages);

        await markConversationAsSeen(selectedFriend.userId);

        if (!active) return;

        const seenAt = new Date().toISOString();

        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender_id === selectedFriend.userId && !msg.seen_at
              ? { ...msg, seen_at: seenAt }
              : msg
          )
        );

        onUnreadCountsChange?.({
          ...unreadCounts,
          [selectedFriend.userId]: 0,
        });

        void conversationControllerRef.current?.destroy();

        const controller = await createConversationRealtime(
          selectedFriend.userId,
          myAvailability,
          {
            onMessage: (incoming) => {
              setMessages((prev) => {
                if (prev.some((m) => m.id === incoming.id)) return prev;
                return [...prev, incoming];
              });

              setSidebarState((prev) => ({
                ...prev,
                [selectedFriend.userId]: {
                  friendId: selectedFriend.userId,
                  lastMessage: incoming.content,
                  lastMessageAt: incoming.created_at,
                  lastMessageIsMine: incoming.sender_id !== selectedFriend.userId,
                  unreadCount: 0,
                },
              }));

              if (incoming.sender_id === selectedFriend.userId) {
                const seenNow = new Date().toISOString();

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === incoming.id ? { ...msg, seen_at: seenNow } : msg
                  )
                );

                onUnreadCountsChange?.({
                  ...unreadCounts,
                  [selectedFriend.userId]: 0,
                });

                void markConversationAsSeen(selectedFriend.userId);
              }
            },
            onTypingChange: (isTyping) => {
              setTyping(isTyping);
            },
            onSeenUpdate: (updated) => {
              setMessages((prev) =>
                prev.map((msg) => (msg.id === updated.id ? updated : msg))
              );
            },
          }
        );

        conversationControllerRef.current = controller;
      } catch (error) {
        console.error(error);
      }
    };

    void bootConversation();

    return () => {
      active = false;
      setTyping(false);
      void conversationControllerRef.current?.destroy();
      conversationControllerRef.current = null;
    };
  }, [selectedFriend?.userId, open, myAvailability]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const handleSearch = async (value: string) => {
    try {
      setSearch(value);

      if (!value.trim()) {
        setSearchResults([]);
        return;
      }

      const results = await searchProfiles(value);
      setSearchResults(results);
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Erreur recherche.");
    }
  };

  const handleAddFriend = async (userId: string) => {
    try {
      setMessage(null);
      await sendFriendRequest(userId);
      setMessage("Demande d’ami envoyée.");
      setSearch("");
      setSearchResults([]);
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Erreur envoi demande.");
    }
  };

  const handleAccept = async (requestId: string) => {
    try {
      setMessage(null);
      await acceptFriendRequest(requestId);
      await loadPanelData();
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Erreur acceptation.");
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setMessage(null);
      await rejectFriendRequest(requestId);
      await loadPanelData();
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Erreur refus.");
    }
  };

  const handleRemoveFriend = async (requestId: string) => {
    try {
      setMessage(null);
      await removeFriendRequestOrFriend(requestId);

      if (selectedFriend?.requestId === requestId) {
        setSelectedFriend(null);
        setMessages([]);
      }

      await loadPanelData();
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Erreur suppression.");
    }
  };

  const handleFriendClick = (friend: FriendLike) => {
    setSelectedFriend(friend);
    setTyping(false);
    setShowEmojiPicker(false);
  };

  const handleInputChange = async (value: string) => {
    setMessageInput(value);

    if (!selectedFriend || !conversationControllerRef.current) return;

    try {
      await conversationControllerRef.current.setTyping(value.trim().length > 0);

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(async () => {
        try {
          await conversationControllerRef.current?.setTyping(false);
        } catch (error) {
          console.error(error);
        }
      }, 1200);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSendMessage = async () => {
    try {
      if (!selectedFriend) return;
      if (!messageInput.trim()) return;

      const created = await sendMessage(selectedFriend.userId, messageInput);

      setMessages((prev) => {
        if (prev.some((m) => m.id === created.id)) return prev;
        return [...prev, created];
      });

      setSidebarState((prev) => ({
        ...prev,
        [selectedFriend.userId]: {
          friendId: selectedFriend.userId,
          lastMessage: created.content,
          lastMessageAt: created.created_at,
          lastMessageIsMine: true,
          unreadCount: 0,
        },
      }));

      setMessageInput("");
      setShowEmojiPicker(false);

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      await conversationControllerRef.current?.setTyping(false);
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Erreur envoi message.");
    }
  };

  const addEmoji = async (emoji: string) => {
    const next = `${messageInput}${emoji}`;
    setMessageInput(next);

    if (selectedFriend && conversationControllerRef.current) {
      try {
        await conversationControllerRef.current.setTyping(true);
      } catch (error) {
        console.error(error);
      }
    }
  };

  const renderFriendItem = (
    friend: FriendLike & {
      liveStatus: UserStatus;
      unreadCount: number;
      preview: string | null;
      previewAt: string | null;
    }
  ) => {
    const hasUnread = friend.unreadCount > 0;

    return (
      <button
        key={friend.requestId}
        onClick={() => handleFriendClick(friend)}
        className={[
          "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
          selectedFriend?.userId === friend.userId
            ? "border-white/15 bg-white/10"
            : "border-white/10 bg-white/5 hover:bg-white/8",
        ].join(" ")}
      >
        <div className="relative">
          {friend.avatar_url ? (
            <img
              src={friend.avatar_url}
              alt={friend.username}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400/80 to-cyan-300/80 font-bold text-black">
              {friend.username?.charAt(0)?.toUpperCase() || "?"}
            </div>
          )}

          <span
            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0f141b] ${getStatusDotClass(
              friend.liveStatus
            )}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {friend.username}
          </p>

          <p className="truncate text-xs text-white/40">
            {friend.preview || friend.liveStatus}
          </p>
        </div>

        {hasUnread && (
          <div className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
            {friend.unreadCount > 9 ? "9+" : friend.unreadCount}
          </div>
        )}
      </button>
    );
  };

  return (
    <div
      className={[
        "fixed inset-y-0 right-0 z-50 w-[760px] max-w-[92vw] transform border-l border-white/10 bg-[#0f141b]/95 backdrop-blur-xl transition-transform duration-300",
        open ? "translate-x-0" : "translate-x-full",
      ].join(" ")}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30">
              Social
            </p>
            <h2 className="mt-1 text-2xl font-bold text-white">Amis & Chat</h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Fermer
          </button>
        </div>

        <div className="border-b border-white/10 p-4">
          <input
            value={search}
            onChange={(e) => void handleSearch(e.target.value)}
            placeholder="Rechercher un pseudo..."
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/30"
          />

          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex items-center gap-3">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.username}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400/80 to-cyan-300/80 font-bold text-black">
                        {user.username?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-semibold text-white">
                        {user.username}
                      </p>
                      <p className="text-xs text-white/45">{user.status}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => void handleAddFriend(user.id)}
                    className="rounded-xl bg-blue-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-400"
                  >
                    Ajouter
                  </button>
                </div>
              ))}
            </div>
          )}

          {message && <p className="mt-3 text-sm text-white/65">{message}</p>}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[230px_1fr]">
          <div className="overflow-y-auto border-r border-white/10 p-4">
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/35">
                Demandes
              </h3>

              <div className="space-y-3">
                {requests.map((request) => (
                  <div
                    key={request.requestId}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3"
                  >
                    <p className="truncate text-sm font-semibold text-white">
                      {request.username}
                    </p>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => void handleAccept(request.requestId)}
                        className="rounded-xl bg-green-500 px-2 py-1 text-xs font-medium text-white"
                      >
                        OK
                      </button>

                      <button
                        onClick={() => void handleReject(request.requestId)}
                        className="rounded-xl bg-red-500 px-2 py-1 text-xs font-medium text-white"
                      >
                        Non
                      </button>
                    </div>
                  </div>
                ))}

                {requests.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/45">
                    Aucune demande.
                  </div>
                )}
              </div>
            </section>

            <section className="mt-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/35">
                En ligne
              </h3>

              <div className="space-y-2">
                {onlineFriends.map(renderFriendItem)}

                {onlineFriends.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/45">
                    Aucun ami en ligne.
                  </div>
                )}
              </div>
            </section>

            <section className="mt-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-white/35">
                Hors ligne
              </h3>

              <div className="space-y-2">
                {offlineFriends.map(renderFriendItem)}

                {offlineFriends.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/45">
                    Aucun ami hors ligne.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="flex min-h-0 flex-col">
            {!selectedFriend && (
              <div className="flex flex-1 items-center justify-center p-6 text-center text-white/45">
                Clique sur un ami pour ouvrir la conversation.
              </div>
            )}

            {selectedFriend && (
              <>
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <div className="flex items-center gap-3">
                    {selectedFriend.avatar_url ? (
                      <img
                        src={selectedFriend.avatar_url}
                        alt={selectedFriend.username}
                        className="h-11 w-11 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-400/80 to-cyan-300/80 font-bold text-black">
                        {selectedFriend.username?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    )}

                    <div>
                      <p className="text-base font-semibold text-white">
                        {selectedFriend.username}
                      </p>
                      <p className="text-xs text-white/45">
                        {selectedFriendLiveStatus}
                        {typing ? " • est en train d’écrire..." : ""}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => void handleRemoveFriend(selectedFriend.requestId)}
                    className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
                  >
                    Retirer
                  </button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  {messages.length === 0 && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/45">
                      Aucun message pour le moment.
                    </div>
                  )}

                  {messages.map((msg) => {
                    const isMine = msg.sender_id !== selectedFriend.userId;

                    return (
                      <div
                        key={msg.id}
                        className={[
                          "w-fit max-w-[92%] rounded-2xl px-4 py-3 text-sm shadow-[0_10px_30px_rgba(0,0,0,0.12)]",
                          isMine
                            ? "ml-auto bg-blue-500 text-white"
                            : "bg-white/8 text-white/85",
                        ].join(" ")}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                        <p className="mt-1 text-[10px] opacity-60">
                          {new Date(msg.created_at).toLocaleString()}
                          {isMine ? ` • ${msg.seen_at ? "Lu" : "Envoyé"}` : ""}
                        </p>
                      </div>
                    );
                  })}

                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-white/10 p-4">
                  <div className="relative">
                    {showEmojiPicker && (
                      <div className="absolute bottom-[78px] left-0 z-10 grid w-[280px] grid-cols-6 gap-2 rounded-2xl border border-white/10 bg-[#151c24] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                        {EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => void addEmoji(emoji)}
                            className="rounded-xl bg-white/5 p-2 text-xl transition hover:bg-white/10"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker((prev) => !prev)}
                        className="h-[58px] rounded-2xl border border-white/10 bg-white/5 px-5 text-2xl text-white/75 transition hover:bg-white/10 hover:text-white"
                      >
                        😊
                      </button>

                      <input
                        value={messageInput}
                        onChange={(e) => void handleInputChange(e.target.value)}
                        placeholder="Écrire un message..."
                        className="h-[58px] flex-1 rounded-2xl border border-white/10 bg-black/20 px-5 text-white outline-none placeholder:text-white/30"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void handleSendMessage();
                          }
                        }}
                      />

                      <button
                        onClick={() => void handleSendMessage()}
                        className="h-[58px] min-w-[145px] rounded-2xl bg-blue-500 px-6 text-base font-semibold text-white transition hover:bg-blue-400"
                      >
                        Envoyer
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}