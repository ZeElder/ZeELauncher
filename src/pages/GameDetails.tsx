import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getManifest, getPatchNotes } from "../services/github";
import {
  installGame,
  launchGame,
  listInstalled,
  onDownloadProgress,
  onExtractProgress,
  onInstallState,
  openGameFolder,
  uninstallGame,
} from "../services/launcherApi";
import type { GameManifestItem } from "../types/manifest";
import type {
  GameInstallState,
  InstalledGamesMap,
} from "../types/installed";
import type { PatchNoteItem } from "../types/patchnotes";

type DetailTab = "general" | "patchnotes";

function getGameState(
  game: GameManifestItem,
  installedMap: InstalledGamesMap
): GameInstallState {
  const installed = installedMap[game.id];

  if (!installed) return "not_installed";
  if (installed.installed_version !== game.version) return "update_available";
  return "installed";
}

function getStateLabel(state: GameInstallState) {
  switch (state) {
    case "installed":
      return "Installé";
    case "update_available":
      return "Mise à jour disponible";
    case "not_installed":
      return "Non installé";
  }
}

function getStateClasses(state: GameInstallState) {
  switch (state) {
    case "installed":
      return "bg-green-500/15 text-green-300";
    case "update_available":
      return "bg-amber-500/15 text-amber-300";
    case "not_installed":
      return "bg-red-500/15 text-red-300";
  }
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-xl px-4 py-2.5 text-sm font-semibold transition",
        active
          ? "bg-white text-black"
          : "bg-white/8 text-white/65 hover:bg-white/12 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function GameDetails() {
  const { gameId } = useParams();

  const [game, setGame] = useState<GameManifestItem | null>(null);
  const [installedMap, setInstalledMap] = useState<InstalledGamesMap>({});
  const [patchNotes, setPatchNotes] = useState<PatchNoteItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [downloadProgress, setDownloadProgress] = useState(0);
  const [extractProgress, setExtractProgress] = useState(0);
  const [installState, setInstallState] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [activeTab, setActiveTab] = useState<DetailTab>("general");

  const reloadGame = async () => {
    if (!gameId) return;

    const [manifest, installed] = await Promise.all([
      getManifest(),
      listInstalled(),
    ]);

    const foundGame = manifest.games.find((g) => g.id === gameId) ?? null;

    if (!foundGame) {
      throw new Error("Jeu introuvable.");
    }

    const patchData = await getPatchNotes();

    const filteredPatches = patchData.patches
      .filter((patch) => patch.game.toLowerCase() === foundGame.name.toLowerCase())
      .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));

    setGame(foundGame);
    setInstalledMap(installed);
    setPatchNotes(filteredPatches);
  };

  useEffect(() => {
    const loadGame = async () => {
      try {
        setLoading(true);
        setError(null);
        await reloadGame();
      } catch (err) {
        console.error("GameDetails error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les données du jeu."
        );
      } finally {
        setLoading(false);
      }
    };

    loadGame();
  }, [gameId]);

  useEffect(() => {
    let unlistenDownload: (() => void) | undefined;
    let unlistenExtract: (() => void) | undefined;
    let unlistenState: (() => void) | undefined;

    const setup = async () => {
      unlistenDownload = await onDownloadProgress((event) => {
        if (event.gameId !== gameId) return;
        setDownloadProgress(event.progress);
      });

      unlistenExtract = await onExtractProgress((event) => {
        if (event.gameId !== gameId) return;
        setExtractProgress(event.progress);
      });

      unlistenState = await onInstallState(async (event) => {
        if (event.gameId !== gameId) return;

        setInstallState(event.state);

        if (event.state === "completed") {
          setBusy(false);
          setDownloadProgress(100);
          setExtractProgress(100);
          await reloadGame();
        }

        if (event.state === "error") {
          setBusy(false);
        }
      });
    };

    setup();

    return () => {
      unlistenDownload?.();
      unlistenExtract?.();
      unlistenState?.();
    };
  }, [gameId]);

  const state = useMemo(() => {
    if (!game) return null;
    return getGameState(game, installedMap);
  }, [game, installedMap]);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 text-white/70">
        Chargement du jeu...
      </div>
    );
  }

  if (error || !game || !state) {
    return (
      <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-6 text-white">
        {error ?? "Jeu introuvable."}
      </div>
    );
  }

  const handleInstall = async () => {
    try {
      setBusy(true);
      setInstallState("downloading");
      setDownloadProgress(0);
      setExtractProgress(0);

      await installGame({
        gameId: game.id,
        gameName: game.name,
        version: game.version,
        downloadUrl: game.downloadUrl,
        exeRelativePath: game.exe,
        launcherName: "ZeELauncher",
      });
    } catch (err) {
      console.error("INSTALL ERROR:", err);
      setBusy(false);

      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : JSON.stringify(err, null, 2);

      alert(message);
    }
  };

  const handleUninstall = async () => {
    try {
      setBusy(true);
      await uninstallGame(game.id);
      await reloadGame();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Erreur désinstallation");
    } finally {
      setBusy(false);
      setInstallState(null);
      setDownloadProgress(0);
      setExtractProgress(0);
    }
  };

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
          <div className="max-w-4xl rounded-[24px] border border-white/10 bg-[#0f141b]/85 p-6 backdrop-blur-xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-300/70">
                  Jeu
                </p>
                <h1 className="mt-2 text-4xl font-bold text-white">{game.name}</h1>
              </div>

              {(state === "installed" || state === "update_available") && (
                <button
                  onClick={async () => {
                    try {
                      await openGameFolder(game.id);
                    } catch (err) {
                      console.error(err);
                      alert(
                        err instanceof Error
                          ? err.message
                          : "Erreur ouverture dossier"
                      );
                    }
                  }}
                  title="Ouvrir le dossier du jeu"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl text-white transition hover:bg-white/10"
                >
                  📁
                </button>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <TabButton
                active={activeTab === "general"}
                onClick={() => setActiveTab("general")}
              >
                Général
              </TabButton>

              <TabButton
                active={activeTab === "patchnotes"}
                onClick={() => setActiveTab("patchnotes")}
              >
                Patch Note
              </TabButton>
            </div>

            {activeTab === "general" && (
              <div className="mt-6">
                <p className="text-white/65">{game.description}</p>

                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <span className={`rounded-full px-3 py-1 ${getStateClasses(state)}`}>
                    {getStateLabel(state)}
                  </span>

                  <span className="rounded-full bg-white/5 px-3 py-1 text-white/55">
                    Version distante {game.version}
                  </span>

                  <span className="rounded-full bg-white/5 px-3 py-1 text-white/55">
                    Taille {game.size}
                  </span>

                  {installedMap[game.id] && (
                    <span className="rounded-full bg-white/5 px-3 py-1 text-white/55">
                      Installée {installedMap[game.id].installed_version}
                    </span>
                  )}
                </div>

                {(busy || installState) && (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="mb-3 text-sm font-medium text-white/70">
                      État : {installState ?? "en attente"}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-white/55">
                          <span>Téléchargement</span>
                          <span>{downloadProgress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10">
                          <div
                            className="h-2 rounded-full bg-blue-500 transition-all"
                            style={{ width: `${downloadProgress}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 flex justify-between text-xs text-white/55">
                          <span>Extraction</span>
                          <span>{extractProgress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10">
                          <div
                            className="h-2 rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${extractProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  {state === "not_installed" && (
                    <button
                      onClick={handleInstall}
                      disabled={busy}
                      className="rounded-2xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Installer
                    </button>
                  )}

                  {state === "update_available" && (
                    <>
                      <button
                        onClick={handleInstall}
                        disabled={busy}
                        className="rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Mettre à jour
                      </button>

                      <button
                        onClick={handleUninstall}
                        disabled={busy}
                        className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 font-semibold text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Désinstaller
                      </button>
                    </>
                  )}

                  {state === "installed" && (
                    <>
                      <button
                        onClick={async () => {
                          try {
                            await launchGame(game.id);
                          } catch (err) {
                            console.error(err);
                            alert(
                              err instanceof Error
                                ? err.message
                                : "Erreur lancement jeu"
                            );
                          }
                        }}
                        className="rounded-2xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-500"
                      >
                        Jouer
                      </button>

                      <button
                        onClick={handleUninstall}
                        disabled={busy}
                        className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 font-semibold text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Désinstaller
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === "patchnotes" && (
              <div className="mt-6 space-y-4">
                {patchNotes.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white/60">
                    Aucune patch note disponible pour ce jeu.
                  </div>
                )}

                {patchNotes.map((patch, index) => (
                  <div
                    key={`${patch.version}-${index}`}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white">
                        Version {patch.version}
                      </h3>
                      <span className="text-sm text-white/40">{patch.date}</span>
                    </div>

                    <ul className="space-y-2 text-sm text-white/70">
                      {patch.notes.map((note, i) => (
                        <li key={i}>• {note}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}