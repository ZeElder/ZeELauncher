import { useEffect, useMemo, useState } from "react";
import {
  createSupportTicket,
  deleteSupportTicket,
  getMySupportUserId,
  getSupportTicketMessages,
  getSupportTickets,
  isSupportAdmin,
  markSupportTicketViewed,
  sendSupportTicketMessage,
  subscribeToSupportTicketsRealtime,
  updateSupportTicketStatus,
  type SupportTicketMessage,
  type SupportTicketStatus,
  type SupportTicketType,
  type SupportTicketWithMeta,
} from "../services/support";
import { getSafeErrorMessage } from "../utils/errorMessage";

type StatusFilter = "all" | SupportTicketStatus;
type TypeFilter = "all" | SupportTicketType;

function getStatusClasses(status: SupportTicketStatus) {
  switch (status) {
    case "open":
      return "bg-green-500/15 text-green-300";
    case "in_progress":
      return "bg-amber-500/15 text-amber-300";
    case "closed":
      return "bg-red-500/15 text-red-300";
  }
}

export default function Support() {
  const [tickets, setTickets] = useState<SupportTicketWithMeta[]>([]);
  const [selectedTicket, setSelectedTicket] =
    useState<SupportTicketWithMeta | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [adminMode, setAdminMode] = useState(false);
  const [myUserId, setMyUserId] = useState<string>("");

  const [subject, setSubject] = useState("");
  const [type, setType] = useState<SupportTicketType>("support");
  const [content, setContent] = useState("");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);

  const loadTickets = async () => {
    try {
      setLoading(true);
      setMessage(null);

      const [ticketData, admin, userId] = await Promise.all([
        getSupportTickets(),
        isSupportAdmin(),
        getMySupportUserId(),
      ]);

      setTickets(ticketData);
      setAdminMode(admin);
      setMyUserId(userId);

      if (selectedTicket) {
        const refreshed =
          ticketData.find((t) => t.id === selectedTicket.id) ?? null;
        setSelectedTicket(refreshed);
      }
    } catch (error) {
      console.error(error);
      setMessage(getSafeErrorMessage(error, "Impossible de charger le support."));
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      const data = await getSupportTicketMessages(ticketId);
      setMessages(data);

      await markSupportTicketViewed(ticketId);

      const refreshedTickets = await getSupportTickets();
      setTickets(refreshedTickets);

      const refreshedSelected =
        refreshedTickets.find((ticket) => ticket.id === ticketId) ?? null;
      setSelectedTicket(refreshedSelected);
    } catch (error) {
      console.error(error);
      setMessage(
        getSafeErrorMessage(error, "Impossible de charger la conversation.")
      );
    }
  };

  useEffect(() => {
    void loadTickets();
  }, []);

  useEffect(() => {
    let cleanup: (() => Promise<void>) | null = null;

    const bootRealtime = async () => {
      cleanup = await subscribeToSupportTicketsRealtime(async () => {
        await loadTickets();

        if (selectedTicket?.id) {
          await loadMessages(selectedTicket.id);
        }
      });
    };

    void bootRealtime();

    return () => {
      void cleanup?.();
    };
  }, [selectedTicket?.id]);

  useEffect(() => {
    if (!selectedTicket) {
      setMessages([]);
      return;
    }

    void loadMessages(selectedTicket.id);
  }, [selectedTicket?.id]);

  const filteredTickets = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      if (statusFilter !== "all" && ticket.status !== statusFilter) {
        return false;
      }

      if (typeFilter !== "all" && ticket.type !== typeFilter) {
        return false;
      }

      if (onlyUnread && !ticket.unread) {
        return false;
      }

      if (searchValue) {
        const haystack = [
          ticket.subject,
          ticket.last_message_preview ?? "",
          ticket.type,
          ticket.status,
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(searchValue)) {
          return false;
        }
      }

      return true;
    });
  }, [tickets, statusFilter, typeFilter, onlyUnread, search]);

  const unreadTicketCount = useMemo(() => {
    return tickets.filter((ticket) => ticket.unread).length;
  }, [tickets]);

  const handleCreateTicket = async () => {
    try {
      setSending(true);
      setMessage(null);

      const ticket = await createSupportTicket({
        subject,
        type,
        content,
      });

      setSubject("");
      setType("support");
      setContent("");

      await loadTickets();

      const refreshedTickets = await getSupportTickets();
      const createdTicket =
        refreshedTickets.find((t) => t.id === ticket.id) ?? null;

      setTickets(refreshedTickets);
      setSelectedTicket(createdTicket);

      if (createdTicket) {
        await loadMessages(createdTicket.id);
      }

      setMessage("Ticket créé avec succès.");
    } catch (error) {
      console.error(error);
      setMessage(getSafeErrorMessage(error, "Impossible de créer le ticket."));
    } finally {
      setSending(false);
    }
  };

  const handleSendReply = async () => {
    try {
      if (!selectedTicket) return;

      setSending(true);
      setMessage(null);

      const created = await sendSupportTicketMessage(selectedTicket.id, reply);

      setMessages((prev) => [...prev, created]);
      setReply("");

      await loadTickets();
      await loadMessages(selectedTicket.id);
    } catch (error) {
      console.error(error);
      setMessage(getSafeErrorMessage(error, "Impossible d’envoyer la réponse."));
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status: SupportTicketStatus) => {
    try {
      if (!selectedTicket) return;

      await updateSupportTicketStatus(selectedTicket.id, status);
      await loadTickets();
    } catch (error) {
      console.error(error);
      setMessage(getSafeErrorMessage(error, "Impossible de changer le statut."));
    }
  };

  const handleDeleteTicket = async () => {
    try {
      if (!selectedTicket) return;

      const confirmed = window.confirm(
        "Supprimer définitivement ce ticket ?"
      );

      if (!confirmed) return;

      await deleteSupportTicket(selectedTicket.id);

      setSelectedTicket(null);
      setMessages([]);
      await loadTickets();
    } catch (error) {
      console.error(error);
      setMessage(getSafeErrorMessage(error, "Impossible de supprimer le ticket."));
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-180px)] gap-6 xl:grid-cols-[380px_1fr]">
      <section className="rounded-[28px] border border-white/10 bg-[#11161d] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/30">
          Support
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          Support / Suggestion
        </h1>
        <p className="mt-2 text-white/60">
          Ouvre un ticket pour demander de l’aide ou proposer une suggestion.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm text-white/70">Sujet</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              placeholder="Ex: Bug sur MobFall"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SupportTicketType)}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
            >
              <option value="support" className="bg-[#11161d]">
                Support
              </option>
              <option value="suggestion" className="bg-[#11161d]">
                Suggestion
              </option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">Message</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              placeholder="Décris ton problème ou ta suggestion..."
            />
          </div>

          <button
            onClick={() => void handleCreateTicket()}
            disabled={sending}
            className="w-full rounded-2xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:opacity-60"
          >
            {sending ? "Envoi..." : "Créer le ticket"}
          </button>

          {message && <p className="text-sm text-white/65">{message}</p>}
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">
              {adminMode ? "Tous les tickets" : "Mes tickets"}
            </h2>

            {unreadTicketCount > 0 && (
              <span className="rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold text-white">
                {unreadTicketCount > 99 ? "99+" : unreadTicketCount}
              </span>
            )}
          </div>

          {adminMode && (
            <div className="mt-4 space-y-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un ticket..."
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StatusFilter)
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="all" className="bg-[#11161d]">
                    Tous les statuts
                  </option>
                  <option value="open" className="bg-[#11161d]">
                    Open
                  </option>
                  <option value="in_progress" className="bg-[#11161d]">
                    In progress
                  </option>
                  <option value="closed" className="bg-[#11161d]">
                    Closed
                  </option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="all" className="bg-[#11161d]">
                    Tous les types
                  </option>
                  <option value="support" className="bg-[#11161d]">
                    Support
                  </option>
                  <option value="suggestion" className="bg-[#11161d]">
                    Suggestion
                  </option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={onlyUnread}
                  onChange={(e) => setOnlyUnread(e.target.checked)}
                />
                Uniquement non lus
              </label>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {loading && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/60">
                Chargement...
              </div>
            )}

            {!loading && filteredTickets.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/60">
                Aucun ticket.
              </div>
            )}

            {!loading &&
              filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={[
                    "relative w-full rounded-2xl border p-4 text-left transition",
                    selectedTicket?.id === ticket.id
                      ? "border-white/15 bg-white/10"
                      : "border-white/10 bg-white/5 hover:bg-white/8",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {ticket.subject}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        {ticket.type === "support" ? "Support" : "Suggestion"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {ticket.unread && (
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                      )}

                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${getStatusClasses(
                          ticket.status
                        )}`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                  </div>

                  {ticket.last_message_preview && (
                    <p className="mt-3 truncate text-xs text-white/40">
                      {ticket.last_message_preview}
                    </p>
                  )}

                  <p className="mt-3 text-xs text-white/35">
                    {new Date(
                      ticket.last_message_at ?? ticket.updated_at
                    ).toLocaleString()}
                  </p>
                </button>
              ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-[#11161d] p-6">
        {!selectedTicket && (
          <div className="flex h-full min-h-[420px] items-center justify-center text-center text-white/45">
            Sélectionne un ticket pour voir la conversation.
          </div>
        )}

        {selectedTicket && (
          <div className="flex h-full min-h-[420px] flex-col">
            <div className="border-b border-white/10 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {selectedTicket.subject}
                  </h2>
                  <p className="mt-1 text-sm text-white/50">
                    {selectedTicket.type === "support"
                      ? "Ticket support"
                      : "Suggestion"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                      selectedTicket.status
                    )}`}
                  >
                    {selectedTicket.status}
                  </span>

                  {adminMode && (
                    <button
                      onClick={() => void handleDeleteTicket()}
                      className="rounded-xl bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/25"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>

              {adminMode && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => void handleStatusChange("open")}
                    className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white/75 hover:bg-white/15"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => void handleStatusChange("in_progress")}
                    className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white/75 hover:bg-white/15"
                  >
                    In progress
                  </button>
                  <button
                    onClick={() => void handleStatusChange("closed")}
                    className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white/75 hover:bg-white/15"
                  >
                    Closed
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto py-5">
              {messages.map((msg) => {
                const isMine = msg.sender_id === myUserId;

                return (
                  <div
                    key={msg.id}
                    className={[
                      "w-fit max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                      isMine
                        ? "ml-auto bg-blue-500 text-white"
                        : "bg-white/8 text-white/85",
                    ].join(" ")}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                    <p className="mt-2 text-[10px] opacity-60">
                      {new Date(msg.created_at).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="flex gap-3">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Répondre au ticket..."
                  className="h-[54px] flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 text-white outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSendReply();
                    }
                  }}
                />

                <button
                  onClick={() => void handleSendReply()}
                  disabled={sending}
                  className="rounded-2xl bg-blue-500 px-5 font-semibold text-white transition hover:bg-blue-400 disabled:opacity-60"
                >
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}