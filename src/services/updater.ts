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
  sha256: string;
}

export interface LauncherUpdateProgressEvent {
  progress: number;
  downloaded: number;
  total?: number;
  state: "downloading" | "ready" | "launching" | string;
}

function isValidUpdateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "github.com" &&
      parsed.pathname.includes("/ZeElder/ZeELauncher/")
    );
  } catch {
    return false;
  }
}

function isValidSha256(value: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(value);
}

function isValidUpdateFile(data: LauncherUpdateFile): boolean {
  return Boolean(
    data &&
      data.version &&
      data.downloadUrl &&
      data.sha256 &&
      isValidUpdateUrl(data.downloadUrl) &&
      isValidSha256(data.sha256)
  );
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

    if (!isValidUpdateFile(data)) {
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

export async function downloadLauncherUpdate(
  downloadUrl: string,
  sha256: string
): Promise<void> {
  if (!isValidUpdateUrl(downloadUrl)) {
    throw new Error("URL update non autorisée.");
  }

  if (!isValidSha256(sha256)) {
    throw new Error("SHA256 update invalide.");
  }

  await invoke("download_launcher_update", { url: downloadUrl, sha256 });
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