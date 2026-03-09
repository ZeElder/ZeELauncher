import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import SideNav from "./SideNav";
import TopBar from "./TopBar";
import FriendsPanel from "./FriendsPanel";
import {
  checkLauncherUpdate,
  installLauncherUpdate,
  onLauncherUpdateProgress,
} from "../../services/updater";

export default function ShellLayout() {
  const [friendsOpen, setFriendsOpen] = useState(false);

  const [updateInfo, setUpdateInfo] = useState<null | {
    version: string;
    versionId?: number;
    notes?: string;
    downloadUrl: string;
  }>(null);

  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateState, setUpdateState] = useState<string | null>(null);

  useEffect(() => {
    const runUpdateCheck = async () => {
      try {
        const update = await checkLauncherUpdate();

        if (update) {
          setUpdateInfo({
            version: update.version,
            versionId: update.versionId,
            notes: update.notes,
            downloadUrl: update.downloadUrl,
          });
        }
      } catch (error) {
        console.error("Custom launcher updater check failed:", error);
      }
    };

    void runUpdateCheck();
  }, []);

  useEffect(() => {
    let unlisten: Unlisten | null = null;

    type Unlisten = () => void;

    const setup = async () => {
      try {
        unlisten = await onLauncherUpdateProgress((event) => {
          setUpdateProgress(event.progress ?? 0);
          setUpdateState(event.state ?? null);
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

  const handleLauncherUpdate = async () => {
    if (!updateInfo) return;

    try {
      setUpdating(true);
      setUpdateProgress(0);
      setUpdateState("downloading");
      await installLauncherUpdate(updateInfo.downloadUrl);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Erreur mise à jour launcher"
      );
      setUpdating(false);
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

                <div className="flex min-w-[280px] flex-col gap-3">
                  {!updating && (
                    <button
                      onClick={handleLauncherUpdate}
                      className="rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-400"
                    >
                      Mettre à jour le launcher
                    </button>
                  )}

                  {updating && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="mb-3 text-sm font-medium text-white/75">
                        {updateState === "launching"
                          ? "Lancement de l’installateur..."
                          : "Téléchargement de la mise à jour..."}
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