import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";

const UPDATE_URL =
  "https://raw.githubusercontent.com/ZeElder/ZeELauncher/main/launcher-update.json";

export async function checkLauncherUpdate() {
  const localVersion = await getVersion();

  const res = await fetch(UPDATE_URL);
  const data = await res.json();

  if (data.version !== localVersion) {
    return data;
  }

  return null;
}

export async function installLauncherUpdate(downloadUrl: string) {
  await invoke("install_launcher_update", { url: downloadUrl });
}