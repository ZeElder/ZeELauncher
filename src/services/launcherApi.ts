import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { InstalledGamesMap } from "../types/installed";

export interface InstallGamePayload {
  gameId: string;
  gameName: string;
  version: string;
  downloadUrl: string;
  exeRelativePath: string;
  launcherName: string;
}

export interface InstallProgressEvent {
  gameId: string;
  progress: number;
  transferred?: number;
  total?: number;
}

export interface InstallStateEvent {
  gameId: string;
  state: "downloading" | "extracting" | "completed" | "error";
  message?: string;
}

export async function listInstalled(): Promise<InstalledGamesMap> {
  return invoke<InstalledGamesMap>("list_installed");
}

export async function installGame(payload: InstallGamePayload): Promise<void> {
  return invoke("install_game", { payload });
}

export async function uninstallGame(gameId: string): Promise<void> {
  return invoke("uninstall_game", { gameId });
}

export async function launchGame(gameId: string): Promise<void> {
  return invoke("launch_game", { gameId });
}

export async function openGameFolder(gameId: string): Promise<void> {
  return invoke("open_game_folder", { gameId });
}

export async function onDownloadProgress(
  callback: (event: InstallProgressEvent) => void
): Promise<UnlistenFn> {
  return listen<InstallProgressEvent>("download_progress", (event) => {
    callback(event.payload);
  });
}

export async function onExtractProgress(
  callback: (event: InstallProgressEvent) => void
): Promise<UnlistenFn> {
  return listen<InstallProgressEvent>("extract_progress", (event) => {
    callback(event.payload);
  });
}

export async function onInstallState(
  callback: (event: InstallStateEvent) => void
): Promise<UnlistenFn> {
  return listen<InstallStateEvent>("install_state", (event) => {
    callback(event.payload);
  });
}