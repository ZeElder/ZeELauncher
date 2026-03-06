import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type LauncherUpdateInfo =
  | { available: false }
  | {
      available: true;
      version: string;
      currentVersion: string;
      body?: string;
      date?: string;
    };

export async function checkForLauncherUpdate(): Promise<LauncherUpdateInfo> {
  const update = await check();

  if (!update) {
    return { available: false };
  }

  return {
    available: true,
    version: update.version,
    currentVersion: update.currentVersion,
    body: update.body ?? "",
    date: update.date ?? "",
  };
}

export async function downloadAndInstallLauncherUpdate(
  onProgress?: (progress: number) => void
): Promise<boolean> {
  const update = await check();

  if (!update) {
    return false;
  }

  let downloaded = 0;
  let contentLength = 0;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        contentLength = event.data.contentLength ?? 0;
        downloaded = 0;
        onProgress?.(0);
        break;

      case "Progress":
        downloaded += event.data.chunkLength ?? 0;
        if (contentLength > 0) {
          onProgress?.(Math.round((downloaded / contentLength) * 100));
        }
        break;

      case "Finished":
        onProgress?.(100);
        break;
    }
  });

  return true;
}

export async function relaunchLauncher() {
  await relaunch();
}