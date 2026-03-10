import { useEffect, useMemo, useState } from "react";
import {
  acceptFriendRequest,
  getFriendsList,
  getIncomingFriendRequests,
  rejectFriendRequest,
  removeFriendRequestOrFriend,
  searchProfiles,
  sendFriendRequest,
} from "../../services/friends";
import type { UserStatus } from "../../types/profile";

type Props = {
  open: boolean;
  onClose: () => void;
};

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

export default function FriendsPanel({ open, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const onlineFriends = useMemo(
    () => friends.filter((f) => f.status === "En ligne" || f.status === "Inactive"),
    [friends]
  );

  const offlineFriends = useMemo(
    () => friends.filter((f) => f.status === "Hors ligne"),
    [friends]
  );

  const loadPanelData = async () => {
    try {
      setMessage(null);

      const [friendsData, requestsData] = await Promise.all([
        getFriendsList(),
        getIncomingFriendRequests(),
      ]);

      setFriends(friendsData);
      setRequests(requestsData);
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Erreur chargement amis.");
    }
  };

  useEffect(() => {
    if (open) {
      void loadPanelData();
    }
  }, [open]);

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
      setSearchResults([]);
      setSearch("");
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
      await loadPanelData();
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Erreur suppression.");
    }
  };

  return (
    <div
      className={[
        "fixed inset-y-0 right-0 z-50 w-[380px] transform border-l border-white/10 bg-[#0f141b]/95 backdrop-blur-xl transition-transform duration-300",
        open ? "translate-x-0" : "translate-x-full",
      ].join(" ")}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30">
              Social
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">Amis</h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl bg-white/5 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
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

          {message && (
            <p className="mt-3 text-sm text-white/65">{message}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-white/35">
                Demandes reçues
              </h3>

              <div className="space-y-3">
                {requests.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
                    Aucune demande en attente.
                  </div>
                )}

                {requests.map((request) => (
                  <div
                    key={request.requestId}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center gap-3">
                      {request.avatar_url ? (
                        <img
                          src={request.avatar_url}
                          alt={request.username}
                          className="h-11 w-11 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-400/80 to-cyan-300/80 font-bold text-black">
                          {request.username?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                      )}

                      <div>
                        <p className="text-sm font-semibold text-white">
                          {request.username}
                        </p>
                        <p className="text-xs text-white/45">{request.status}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => void handleAccept(request.requestId)}
                        className="rounded-xl bg-green-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-400"
                      >
                        Accepter
                      </button>

                      <button
                        onClick={() => void handleReject(request.requestId)}
                        className="rounded-xl bg-red-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-400"
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-white/35">
                En ligne — {onlineFriends.length}
              </h3>

              <div className="space-y-3">
                {onlineFriends.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
                    Aucun ami en ligne.
                  </div>
                )}

                {onlineFriends.map((friend) => (
                  <div
                    key={friend.requestId}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {friend.avatar_url ? (
                          <img
                            src={friend.avatar_url}
                            alt={friend.username}
                            className="h-11 w-11 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-400/80 to-cyan-300/80 font-bold text-black">
                            {friend.username?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                        )}

                        <span
                          className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#0f141b] ${getStatusDotClass(
                            friend.status
                          )}`}
                        />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-white">
                          {friend.username}
                        </p>
                        <p className="text-xs text-white/45">{friend.status}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => void handleRemoveFriend(friend.requestId)}
                      className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
                    >
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-white/35">
                Hors ligne — {offlineFriends.length}
              </h3>

              <div className="space-y-3">
                {offlineFriends.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
                    Aucun ami hors ligne.
                  </div>
                )}

                {offlineFriends.map((friend) => (
                  <div
                    key={friend.requestId}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {friend.avatar_url ? (
                          <img
                            src={friend.avatar_url}
                            alt={friend.username}
                            className="h-11 w-11 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-400/80 to-cyan-300/80 font-bold text-black">
                            {friend.username?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                        )}

                        <span
                          className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#0f141b] ${getStatusDotClass(
                            friend.status
                          )}`}
                        />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-white">
                          {friend.username}
                        </p>
                        <p className="text-xs text-white/45">{friend.status}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => void handleRemoveFriend(friend.requestId)}
                      className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
                    >
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}