import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

const UPDATE_URL =
  "https://raw.githubusercontent.com/ZeElder/ZeELauncher/main/launcher-update.json";

export interface LauncherUpdateFile {
  version: string;
  versionId?: number;
  notes?: string;
  downloadUrl: string;
}

export interface LauncherUpdateProgressEvent {
  progress: number;
  downloaded: number;
  total?: number;
  state: "downloading" | "ready" | "launching" | string;
}

export async function checkLauncherUpdate(): Promise<LauncherUpdateFile | null> {
  try {
    const localVersion = await getVersion();

    const response = await fetch(UPDATE_URL, {
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("launcher-update.json HTTP error:", response.status);
      return null;
    }

    const data = (await response.json()) as LauncherUpdateFile;

    if (!data?.version || !data?.downloadUrl) {
      console.error("launcher-update.json invalide:", data);
      return null;
    }

    if (data.version !== localVersion) {
      return data;
    }

    return null;
  } catch (error) {
    console.error("Updater check failed:", error);
    return null;
  }
}

export async function downloadLauncherUpdate(downloadUrl: string): Promise<void> {
  await invoke("download_launcher_update", { url: downloadUrl });
}

export async function installDownloadedLauncherUpdate(): Promise<void> {
  await invoke("install_downloaded_launcher_update");
}

export async function onLauncherUpdateProgress(
  callback: (event: LauncherUpdateProgressEvent) => void
): Promise<UnlistenFn> {
  return listen<LauncherUpdateProgressEvent>(
    "launcher_update_progress",
    (event) => {
      callback(event.payload);
    }
  );
}