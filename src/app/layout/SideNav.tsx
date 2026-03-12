import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getManifest } from "../../services/github";
import { logout } from "../../services/auth";
import { getMyRemoteProfile } from "../../services/profileRemote";
import { subscribeProfile } from "../../stores/profileStore";
import type { GameManifestItem } from "../../types/manifest";
import type { UserStatus } from "../../types/profile";

type SidebarProfile = {
  username: string;
  tag: string;
  avatar_url: string;
  status: UserStatus;
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

export default function SideNav() {
  const navigate = useNavigate();
  const [gamesOpen, setGamesOpen] = useState(true);
  const [games, setGames] = useState<GameManifestItem[]>([]);
  const [profile, setProfile] = useState<SidebarProfile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [manifest, remoteProfile] = await Promise.all([
          getManifest(),
          getMyRemoteProfile(),
        ]);

        setGames(manifest.games);
        setProfile({
          username: remoteProfile.username,
          tag: remoteProfile.tag,
          avatar_url: remoteProfile.avatar_url,
          status: remoteProfile.status,
        });
      } catch (error) {
        console.error("Erreur chargement sidebar:", error);
      }
    };

    void loadData();

    const unsubscribe = subscribeProfile((updated) => {
      setProfile({
        username: updated.username,
        tag: updated.tag,
        avatar_url: updated.avatar_url,
        status: updated.status,
      });
    });

    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Erreur déconnexion");
    } finally {
      setLoggingOut(false);
    }
  };

  const mainLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "group relative rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
      isActive
        ? "bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
        : "text-white/60 hover:bg-white/5 hover:text-white",
    ].join(" ");

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-white/8 bg-[#0d1218]/95 px-4 py-5 backdrop-blur-xl">
      <div className="mb-6 rounded-3xl border border-white/8 bg-white/5 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/20 text-lg font-bold text-blue-300">
            Z
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide text-white">
              ZeeLauncher
            </h1>
            <p className="text-xs text-white/40">Riot × Steam style</p>
          </div>
        </div>
      </div>

      <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">
        Navigation
      </div>

      <nav className="flex flex-col gap-2">
        <NavLink to="/" end className={mainLinkClass}>
          Accueil
        </NavLink>

        <div className="overflow-hidden rounded-2xl bg-white/[0.03]">
          <div className="flex items-center gap-2 p-2">
            <button
              onClick={() => navigate("/games")}
              className="flex-1 rounded-xl px-3 py-2 text-left text-sm font-medium text-white/75 transition hover:bg-white/5 hover:text-white"
            >
              Les Jeux
            </button>

            <button
              onClick={() => setGamesOpen((prev) => !prev)}
              aria-label={gamesOpen ? "Replier les jeux" : "Déplier les jeux"}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/5 hover:text-white"
            >
              <span
                className={[
                  "text-xs transition-transform duration-200",
                  gamesOpen ? "rotate-180" : "rotate-0",
                ].join(" ")}
              >
                ▼
              </span>
            </button>
          </div>

          {gamesOpen && (
            <div className="mt-1 flex flex-col gap-1 px-2 pb-2">
              {games.map((game) => (
                <NavLink
                  key={game.id}
                  to={`/games/${game.id}`}
                  className={({ isActive }) =>
                    [
                      "rounded-xl px-3 py-2 text-sm transition",
                      isActive
                        ? "bg-blue-500/15 text-blue-300"
                        : "text-white/55 hover:bg-white/5 hover:text-white",
                    ].join(" ")
                  }
                >
                  {game.name}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="mt-auto space-y-3">
        <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">
          Compte
        </div>

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            [
              "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-200",
              isActive
                ? "border-white/10 bg-white/10 text-white"
                : "border-white/8 bg-white/5 text-white/70 hover:bg-white/8 hover:text-white",
            ].join(" ")
          }
        >
          <div className="relative">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400/80 to-cyan-300/80 font-bold text-black">
                {profile?.username?.charAt(0)?.toUpperCase() || "M"}
              </div>
            )}

            <span
              className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#0d1218] ${
                profile ? getStatusDotClass(profile.status) : "bg-zinc-500"
              }`}
            />
          </div>

          <div>
            <p className="text-sm font-semibold">
              {profile ? `${profile.username}#${profile.tag}` : "Mon Profil"}
            </p>
            <p className="text-xs text-white/40">
              {profile?.status || "Chargement..."}
            </p>
          </div>
        </NavLink>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loggingOut ? "Déconnexion..." : "Se déconnecter"}
        </button>
      </div>
    </aside>
  );
}