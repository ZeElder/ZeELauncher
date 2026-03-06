import { Link } from "react-router-dom";
import { mockGames } from "../data/mockGames";

export default function Games() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/30">
          Bibliothèque
        </p>
        <h1 className="mt-2 text-4xl font-bold text-white">Les Jeux</h1>
        <p className="mt-2 text-white/60">
          Sélectionne un jeu pour ouvrir sa page dédiée.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
        {mockGames.map((game) => (
          <Link
            key={game.id}
            to={`/games/${game.id}`}
            className="group overflow-hidden rounded-[26px] border border-white/8 bg-[#11161d] transition duration-300 hover:-translate-y-1 hover:border-white/15 hover:shadow-[0_18px_50px_rgba(0,0,0,0.32)]"
          >
            <div className="relative h-52 overflow-hidden">
              <img
                src={game.cover}
                alt={game.name}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/40 to-transparent" />
            </div>

            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">{game.name}</h2>
                <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-300">
                  Disponible
                </span>
              </div>

              <p className="text-sm leading-6 text-white/60">{game.description}</p>

              <div className="pt-1 text-sm font-medium text-blue-300 transition group-hover:text-blue-200">
                Ouvrir la page du jeu →
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}