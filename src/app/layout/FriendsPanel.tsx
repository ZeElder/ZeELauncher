import { useState } from "react";

interface FriendsPanelProps {
  open: boolean;
  onClose: () => void;
}

const mockFriends = [
  { id: 1, name: "Kuro", status: "En ligne", color: "bg-green-500" },
  { id: 2, name: "Nexa", status: "En jeu", color: "bg-blue-500" },
  { id: 3, name: "Rin", status: "Hors ligne", color: "bg-zinc-500" },
  { id: 4, name: "Aster", status: "En ligne", color: "bg-green-500" },
];

export default function FriendsPanel({ open, onClose }: FriendsPanelProps) {
  const [friendName, setFriendName] = useState("");

  return (
    <>
      {open && (
        <button
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/55 backdrop-blur-[2px]"
          aria-label="Fermer le panneau amis"
        />
      )}

      <aside
        className={[
          "fixed right-0 top-0 z-40 flex h-screen w-[360px] flex-col border-l border-white/10 bg-[#0e131a]/95 shadow-[0_0_60px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="border-b border-white/8 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/30">
                Social
              </p>
              <h3 className="mt-1 text-xl font-semibold text-white">Amis</h3>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl bg-white/8 px-3 py-2 text-sm text-white hover:bg-white/12"
            >
              Fermer
            </button>
          </div>
        </div>

        <div className="border-b border-white/8 p-5">
          <label className="mb-2 block text-sm text-white/55">Ajouter un ami</label>
          <div className="flex gap-2">
            <input
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              placeholder="Pseudo..."
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25"
            />
            <button
              className="rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
              onClick={() => {
                if (!friendName.trim()) return;
                alert(`Demande d'ami envoyée à ${friendName}`);
                setFriendName("");
              }}
            >
              Ajouter
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/30">
            Liste d'amis
          </div>

          <div className="space-y-3">
            {mockFriends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 p-3 transition hover:bg-white/8"
              >
                <div className="relative">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 font-semibold text-white">
                    {friend.name.slice(0, 1)}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#0e131a] ${friend.color}`}
                  />
                </div>

                <div>
                  <p className="font-medium text-white">{friend.name}</p>
                  <p className="text-sm text-white/45">{friend.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}