import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

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
  state: string;
}

export async function checkLauncherUpdate(): Promise<LauncherUpdateFile | null> {
  try {
    const localVersion = await getVersion();

    const response = await fetch(UPDATE_URL, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as LauncherUpdateFile;

    if (data.version !== localVersion) {
      return data;
    }

    return null;
  } catch (error) {
    console.error("Updater check failed:", error);
    return null;
  }
}

export async function installLauncherUpdate(downloadUrl: string): Promise<void> {
  await invoke("install_launcher_update", { url: downloadUrl });
}

export async function onLauncherUpdateProgress(
  callback: (event: LauncherUpdateProgressEvent) => void
) {
  return listen<LauncherUpdateProgressEvent>(
    "launcher_update_progress",
    (event) => {
      callback(event.payload);
    }
  );
}