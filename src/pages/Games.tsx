import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getManifest } from "../services/github";
import {
  installGame,
  launchGame,
  listInstalled,
  onDownloadProgress,
  onExtractProgress,
  onInstallState,
  uninstallGame,
} from "../services/launcherApi";
import SmartCover from "../components/SmartCover";
import { getSafeErrorMessage } from "../utils/errorMessage";
import type { GameManifestItem } from "../types/manifest";
import type {
  GameInstallState,
  InstalledGamesMap,
} from "../types/installed";

type FilterMode = "all" | "installed" | "not_installed" | "update_available";
type SortMode = "name_asc" | "name_desc" | "version_desc";

type ProgressState = {
  download: number;
  extract: number;
  state: string | null;
};

function getGameState(
  game: GameManifestItem,
  installedMap: InstalledGamesMap
): GameInstallState {
  const installed = installedMap[game.id];

  if (!installed) return "not_installed";
  if (installed.installed_version !== game.version) return "update_available";
  return "installed";
}

function getBadgeClasses(state: GameInstallState) {
  switch (state) {
    case "installed":
      return "bg-green-500/15 text-green-300 border-green-500/20";
    case "update_available":
      return "bg-amber-500/15 text-amber-300 border-amber-500/20";
    case "not_installed":
      return "bg-red-500/15 text-red-300 border-red-500/20";
  }
}

function getBadgeLabel(state: GameInstallState) {
  switch (state) {
    case "installed":
      return "Installé";
    case "update_available":
      return "Mise à jour";
    case "not_installed":
      return "Non installé";
  }
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-xl px-4 py-2 text-sm font-medium transition",
        active
          ? "bg-white text-black"
          : "bg-white/8 text-white/65 hover:bg-white/12 hover:text-white",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export default function Games() {
  const [games, setGames] = useState<GameManifestItem[]>([]);
  const [installedMap, setInstalledMap] = useState<InstalledGamesMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sort, setSort] = useState<SortMode>("name_asc");

  const [busyGameId, setBusyGameId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [progressByGameId, setProgressByGameId] = useState<
    Record<string, ProgressState>
  >({});

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [manifest, installed] = await Promise.all([
        getManifest(),
        listInstalled(),
      ]);

      setGames(manifest.games);
      setInstalledMap(installed);
    } catch (err) {
      console.error("Games page error:", err);
      setError(getSafeErrorMessage(err, "Impossible de charger les jeux."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    let unlistenDownload: (() => void) | undefined;
    let unlistenExtract: (() => void) | undefined;
    let unlistenState: (() => void) | undefined;

    const setup = async () => {
      unlistenDownload = await onDownloadProgress((event) => {
        setProgressByGameId((prev) => ({
          ...prev,
          [event.gameId]: {
            download: event.progress,
            extract: prev[event.gameId]?.extract ?? 0,
            state: prev[event.gameId]?.state ?? "downloading",
          },
        }));
      });

      unlistenExtract = await onExtractProgress((event) => {
        setProgressByGameId((prev) => ({
          ...prev,
          [event.gameId]: {
            download: prev[event.gameId]?.download ?? 0,
            extract: event.progress,
            state: prev[event.gameId]?.state ?? "extracting",
          },
        }));
      });

      unlistenState = await onInstallState(async (event) => {
        setProgressByGameId((prev) => ({
          ...prev,
          [event.gameId]: {
            download: prev[event.gameId]?.download ?? 0,
            extract: prev[event.gameId]?.extract ?? 0,
            state: event.state,
          },
        }));

        if (event.state === "completed") {
          setBusyGameId((current) =>
            current === event.gameId ? null : current
          );
          await loadData();
        }

        if (event.state === "error") {
          setBusyGameId((current) =>
            current === event.gameId ? null : current
          );
        }
      });
    };

    void setup();

    return () => {
      unlistenDownload?.();
      unlistenExtract?.();
      unlistenState?.();
    };
  }, []);

  const gamesWithState = useMemo(() => {
    return games.map((game) => ({
      ...game,
      state: getGameState(game, installedMap),
    }));
  }, [games, installedMap]);

  const stats = useMemo(() => {
    const total = games.length;
    const installed = gamesWithState.filter((g) => g.state === "installed").length;
    const updates = gamesWithState.filter(
      (g) => g.state === "update_available"
    ).length;

    return { total, installed, updates };
  }, [games, gamesWithState]);

  const updateCandidates = useMemo(() => {
    return gamesWithState.filter((game) => game.state === "update_available");
  }, [gamesWithState]);

  const filteredGames = useMemo(() => {
    let result = [...gamesWithState];

    const trimmed = search.trim().toLowerCase();
    if (trimmed) {
      result = result.filter(
        (game) =>
          game.name.toLowerCase().includes(trimmed) ||
          game.description.toLowerCase().includes(trimmed)
      );
    }

    if (filter !== "all") {
      result = result.filter((game) => game.state === filter);
    }

    result.sort((a, b) => {
      switch (sort) {
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "version_desc":
          return b.version.localeCompare(a.version, undefined, {
            numeric: true,
          });
        default:
          return 0;
      }
    });

    return result;
  }, [gamesWithState, search, filter, sort]);

  const handleInstall = async (game: GameManifestItem) => {
    try {
      setBusyGameId(game.id);
      setProgressByGameId((prev) => ({
        ...prev,
        [game.id]: {
          download: 0,
          extract: 0,
          state: "downloading",
        },
      }));

      await installGame({
        gameId: game.id,
        gameName: game.name,
        version: game.version,
        downloadUrl: game.downloadUrl,
        sha256: game.sha256,
        exeRelativePath: game.exe,
        launcherName: "ZeELauncher",
      });
    } catch (err) {
      console.error(err);
      setBusyGameId(null);
      alert(getSafeErrorMessage(err, "Impossible d’installer le jeu."));
    }
  };

  const handleLaunch = async (gameId: string) => {
    try {
      setBusyGameId(gameId);
      await launchGame(gameId);
    } catch (err) {
      console.error(err);
      alert(getSafeErrorMessage(err, "Impossible de lancer le jeu."));
    } finally {
      setBusyGameId(null);
    }
  };

  const handleUninstall = async (gameId: string) => {
    try {
      setBusyGameId(gameId);
      await uninstallGame(gameId);
      await loadData();
    } catch (err) {
      console.error(err);
      alert(getSafeErrorMessage(err, "Impossible de désinstaller le jeu."));
    } finally {
      setBusyGameId(null);
      setProgressByGameId((prev) => {
        const next = { ...prev };
        delete next[gameId];
        return next;
      });
    }
  };

  const handleUpdateAll = async () => {
    if (updateCandidates.length === 0) return;

    try {
      setBulkUpdating(true);

      for (const game of updateCandidates) {
        setBusyGameId(game.id);
        setProgressByGameId((prev) => ({
          ...prev,
          [game.id]: {
            download: 0,
            extract: 0,
            state: "downloading",
          },
        }));

        await installGame({
          gameId: game.id,
          gameName: game.name,
          version: game.version,
          downloadUrl: game.downloadUrl,
          sha256: game.sha256,
          exeRelativePath: game.exe,
          launcherName: "ZeELauncher",
        });
      }

      await loadData();
    } catch (err) {
      console.error(err);
      alert(getSafeErrorMessage(err, "Impossible de mettre à jour les jeux."));
    } finally {
      setBusyGameId(null);
      setBulkUpdating(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-white/10 bg-[#11161d] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/30">
              Bibliothèque
            </p>
            <h1 className="mt-2 text-4xl font-bold text-white">Les Jeux</h1>
            <p className="mt-2 text-white/60">
              Recherche, filtre et gère ta bibliothèque.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/35">
                Total
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {stats.total}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/35">
                Installés
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {stats.installed}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/35">
                Mises à jour
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {stats.updates}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {updateCandidates.length > 0 && (
            <button
              onClick={() => void handleUpdateAll()}
              disabled={bulkUpdating || busyGameId !== null}
              className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bulkUpdating
                ? "Mise à jour en cours..."
                : `Mettre tout à jour (${updateCandidates.length})`}
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_auto]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un jeu..."
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
          />

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="name_asc" className="bg-[#11161d]">
              Nom A → Z
            </option>
            <option value="name_desc" className="bg-[#11161d]">
              Nom Z → A
            </option>
            <option value="version_desc" className="bg-[#11161d]">
              Version récente
            </option>
          </select>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <FilterButton
            active={filter === "all"}
            label="Tous"
            onClick={() => setFilter("all")}
          />
          <FilterButton
            active={filter === "installed"}
            label="Installés"
            onClick={() => setFilter("installed")}
          />
          <FilterButton
            active={filter === "not_installed"}
            label="Non installés"
            onClick={() => setFilter("not_installed")}
          />
          <FilterButton
            active={filter === "update_available"}
            label="Mises à jour"
            onClick={() => setFilter("update_available")}
          />
        </div>
      </section>

      {loading && (
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 text-white/70">
          Chargement des jeux...
        </div>
      )}

      {error && (
        <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-6 text-white">
          {error}
        </div>
      )}

      {!loading && !error && filteredGames.length === 0 && (
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 text-white/65">
          Aucun jeu ne correspond à ta recherche ou à tes filtres.
        </div>
      )}

      {!loading && !error && filteredGames.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
          {filteredGames.map((game) => {
            const isBusy = busyGameId === game.id;
            const progress = progressByGameId[game.id];

            return (
              <Link
                key={game.id}
                to={`/games/${game.id}`}
                className="group overflow-hidden rounded-[26px] border border-white/8 bg-[#11161d] transition duration-300 hover:-translate-y-1 hover:border-white/15 hover:shadow-[0_18px_50px_rgba(0,0,0,0.32)]"
              >
                <div className="relative h-56 overflow-hidden">
                  <SmartCover
                    src={game.cover}
                    alt={game.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/40 to-transparent" />

                  <div className="absolute left-4 top-4">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${getBadgeClasses(
                        game.state
                      )}`}
                    >
                      {getBadgeLabel(game.state)}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-white">
                        {game.name}
                      </h2>
                      <p className="mt-1 text-sm text-white/45">
                        Version {game.version}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm leading-6 text-white/60">
                    {game.description}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-white/40">
                    <span>Taille {game.size}</span>
                    {installedMap[game.id] && (
                      <span>
                        • Installée : {installedMap[game.id].installed_version}
                      </span>
                    )}
                  </div>

                  {progress && progress.state !== "completed" && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-white/45">
                        {progress.state}
                      </p>

                      <div className="space-y-3">
                        <div>
                          <div className="mb-1 flex justify-between text-xs text-white/50">
                            <span>Téléchargement</span>
                            <span>{progress.download}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10">
                            <div
                              className="h-2 rounded-full bg-blue-500 transition-all"
                              style={{ width: `${progress.download}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="mb-1 flex justify-between text-xs text-white/50">
                            <span>Extraction</span>
                            <span>{progress.extract}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10">
                            <div
                              className="h-2 rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${progress.extract}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 pt-2">
                    {game.state === "not_installed" && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleInstall(game);
                        }}
                        disabled={isBusy || bulkUpdating}
                        className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isBusy ? "Installation..." : "Installer"}
                      </button>
                    )}

                    {game.state === "update_available" && (
                      <>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleInstall(game);
                          }}
                          disabled={isBusy || bulkUpdating}
                          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? "Mise à jour..." : "Mettre à jour"}
                        </button>

                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleUninstall(game.id);
                          }}
                          disabled={isBusy || bulkUpdating}
                          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Désinstaller
                        </button>
                      </>
                    )}

                    {game.state === "installed" && (
                      <>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleLaunch(game.id);
                          }}
                          disabled={isBusy || bulkUpdating}
                          className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? "Ouverture..." : "Jouer"}
                        </button>

                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleUninstall(game.id);
                          }}
                          disabled={isBusy || bulkUpdating}
                          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Désinstaller
                        </button>
                      </>
                    )}
                  </div>

                  <div className="pt-1 text-sm font-medium text-blue-300 transition group-hover:text-blue-200">
                    Ouvrir la page du jeu →
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}