import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import SideNav from "./SideNav";
import TopBar from "./TopBar";
import FriendsPanel from "./FriendsPanel";
import {
  checkForLauncherUpdate,
  downloadAndInstallLauncherUpdate,
  relaunchLauncher,
} from "../../services/updater";

export default function ShellLayout() {
  const [friendsOpen, setFriendsOpen] = useState(false);

  const [updateAvailable, setUpdateAvailable] = useState<null | {
    version: string;
    currentVersion: string;
    body?: string;
    date?: string;
  }>(null);

  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);

  useEffect(() => {
    const runUpdateCheck = async () => {
      try {
        const result = await checkForLauncherUpdate();

        if (result.available) {
          setUpdateAvailable({
            version: result.version,
            currentVersion: result.currentVersion,
            body: result.body,
            date: result.date,
          });
        }
      } catch (error) {
        console.error("Updater check failed:", error);
      }
    };

    runUpdateCheck();
  }, []);

  const handleInstallLauncherUpdate = async () => {
    try {
      setUpdating(true);
      setUpdateProgress(0);

      const installed = await downloadAndInstallLauncherUpdate((progress) => {
        setUpdateProgress(progress);
      });

      if (installed) {
        await relaunchLauncher();
      }
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error ? error.message : "Erreur mise à jour launcher"
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-black text-white">
      <SideNav />

      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar onToggleFriends={() => setFriendsOpen(true)} />

        <main className="flex-1 p-6">
          {updateAvailable && (
            <div className="mb-6 rounded-[24px] border border-amber-500/20 bg-amber-500/10 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/70">
                    Mise à jour launcher
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-white">
                    Nouvelle version disponible : {updateAvailable.version}
                  </h3>
                  <p className="mt-2 text-sm text-white/70">
                    Version actuelle : {updateAvailable.currentVersion}
                  </p>

                  {updateAvailable.body && (
                    <p className="mt-3 text-sm text-white/65">
                      {updateAvailable.body}
                    </p>
                  )}
                </div>

                <div className="flex min-w-[220px] flex-col gap-3">
                  <button
                    onClick={handleInstallLauncherUpdate}
                    disabled={updating}
                    className="rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updating
                      ? `Mise à jour... ${updateProgress ?? 0}%`
                      : "Mettre à jour le launcher"}
                  </button>
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