import { NavLink } from "react-router-dom";

export default function SideNav() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
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
            <h1 className="text-lg font-bold tracking-wide text-white">ZeeLauncher</h1>
            <p className="text-xs text-white/40">Riot × Steam style</p>
          </div>
        </div>
      </div>

      <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">
        Navigation
      </div>

      <nav className="flex flex-col gap-2">
        <NavLink to="/" end className={linkClass}>
          Accueil
        </NavLink>

        <NavLink to="/games" className={linkClass}>
          Les Jeux
        </NavLink>
      </nav>

      <div className="mt-auto">
        <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">
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
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400/80 to-cyan-300/80 font-bold text-black">
            M
          </div>
          <div>
            <p className="text-sm font-semibold">Mon Profil</p>
            <p className="text-xs text-white/40">Voir le profil joueur</p>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}