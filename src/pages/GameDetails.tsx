import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getManifest } from "../services/github";
import type { GameManifestItem } from "../types/manifest";

export default function GameDetails() {
  const { gameId } = useParams();
  const [game, setGame] = useState<GameManifestItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGame = async () => {
      try {
        setLoading(true);
        setError(null);

        const manifest = await getManifest();
        const foundGame = manifest.games.find((g) => g.id === gameId) ?? null;

        if (!foundGame) {
          setError("Jeu introuvable.");
          setGame(null);
          return;
        }

        setGame(foundGame);
      } catch (err) {
        console.error(err);
        setError("Impossible de charger les données du jeu.");
      } finally {
        setLoading(false);
      }
    };

    loadGame();
  }, [gameId]);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 text-white/70">
        Chargement du jeu...
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-6 text-white">
        {error ?? "Jeu introuvable."}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#11161d] shadow-[0_18px_60px_rgba(0,0,0,0.3)]">
        <div className="relative h-[320px] overflow-hidden">
          <img
            src={game.cover}
            alt={game.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f14] via-[#0b0f14]/35 to-transparent" />
        </div>

        <div className="relative -mt-24 p-8">
          <div className="max-w-3xl rounded-[24px] border border-white/10 bg-[#0f141b]/85 p-6 backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-300/70">
              Jeu
            </p>

            <h1 className="mt-2 text-4xl font-bold text-white">{game.name}</h1>

            <p className="mt-4 text-white/65">{game.description}</p>

            <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/55">
              <span className="rounded-full bg-white/5 px-3 py-1">
                Version {game.version}
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1">
                Taille {game.size}
              </span>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button className="rounded-2xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-500">
                Installer
              </button>

              <button className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10">
                Patch notes
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}