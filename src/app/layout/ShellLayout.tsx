import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import SideNav from "./SideNav";
import TopBar from "./TopBar";
import FriendsPanel from "./FriendsPanel";
import {
  checkLauncherUpdate,
  downloadLauncherUpdate,
  installDownloadedLauncherUpdate,
  onLauncherUpdateProgress,
} from "../../services/updater";

type UpdateInfo = {
  version: string;
  versionId?: number;
  notes?: string;
  downloadUrl: string;
};

export default function ShellLayout() {
  const [friendsOpen, setFriendsOpen] = useState(false);

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateChecking, setUpdateChecking] = useState(true);
  const [updateDownloading, setUpdateDownloading] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const runUpdateCheck = async () => {
      try {
        const update = await checkLauncherUpdate();

        if (cancelled || !update) {
          return;
        }

        setUpdateInfo({
          version: update.version,
          versionId: update.versionId,
          notes: update.notes,
          downloadUrl: update.downloadUrl,
        });

        setUpdateDownloading(true);
        setUpdateProgress(0);

        await downloadLauncherUpdate(update.downloadUrl);
      } catch (error) {
        console.error("Silent launcher update failed:", error);
        setUpdateDownloading(false);
      } finally {
        if (!cancelled) {
          setUpdateChecking(false);
        }
      }
    };

    void runUpdateCheck();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setup = async () => {
      try {
        unlisten = await onLauncherUpdateProgress((event) => {
          setUpdateProgress(event.progress ?? 0);

          if (event.state === "downloading") {
            setUpdateDownloading(true);
            setUpdateReady(false);
          }

          if (event.state === "ready") {
            setUpdateDownloading(false);
            setUpdateReady(true);
            setUpdateProgress(100);
          }

          if (event.state === "launching") {
            setUpdateDownloading(false);
          }
        });
      } catch (error) {
        console.error("Updater event listen failed:", error);
      }
    };

    void setup();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleInstallDownloadedUpdate = async () => {
    try {
      await installDownloadedLauncherUpdate();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Erreur installation mise à jour launcher"
      );
    }
  };

  return (
    <div className="flex min-h-screen bg-black text-white">
      <SideNav />

      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar onToggleFriends={() => setFriendsOpen(true)} />

        <main className="flex-1 p-6">
          {updateInfo && (
            <div className="mb-6 rounded-[24px] border border-amber-500/20 bg-amber-500/10 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/70">
                    Mise à jour launcher
                  </p>

                  <h3 className="mt-2 text-xl font-bold text-white">
                    Nouvelle version disponible : {updateInfo.version}
                  </h3>

                  {typeof updateInfo.versionId !== "undefined" && (
                    <p className="mt-2 text-sm text-white/70">
                      ID de version : {updateInfo.versionId}
                    </p>
                  )}

                  {updateInfo.notes && (
                    <p className="mt-3 text-sm text-white/65">
                      {updateInfo.notes}
                    </p>
                  )}
                </div>

                <div className="flex min-w-[320px] flex-col gap-3">
                  {updateDownloading && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="mb-3 text-sm font-medium text-white/75">
                        Téléchargement automatique de la mise à jour...
                      </p>

                      <div className="mb-2 flex justify-between text-xs text-white/50">
                        <span>Progression</span>
                        <span>{updateProgress}%</span>
                      </div>

                      <div className="h-2 rounded-full bg-white/10">
                        <div
                          className="h-2 rounded-full bg-amber-400 transition-all"
                          style={{ width: `${updateProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {updateReady && (
                    <button
                      onClick={handleInstallDownloadedUpdate}
                      className="rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-400"
                    >
                      Redémarrer pour mettre à jour
                    </button>
                  )}

                  {!updateDownloading && !updateReady && !updateChecking && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/65">
                      Mise à jour détectée. Le téléchargement n’a pas pu être finalisé automatiquement.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <Outlet />
        </main>
      </div>

      <FriendsPanel
        open={friendsOpen}
        onClose={() => setFriendsOpen(false)}
      />
    </div>
  );
}