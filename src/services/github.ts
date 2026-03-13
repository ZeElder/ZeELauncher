import { invoke } from "@tauri-apps/api/core";
import type { ManifestData } from "../types/manifest";
import type { PatchNotesData } from "../types/patchnotes";
import type { NewsData } from "../types/news";

function isAllowedGamesDownloadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "github.com" &&
      parsed.pathname.includes("/ZeElder/zeelauncher-games/")
    );
  } catch {
    return false;
  }
}

function isAllowedCoverUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "raw.githubusercontent.com" &&
      parsed.pathname.startsWith("/ZeElder/zeelauncher-data/")
    );
  } catch {
    return false;
  }
}

function isValidSha256(value: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(value);
}

function validateManifest(data: ManifestData): ManifestData {
  if (!data || !Array.isArray(data.games)) {
    throw new Error("Manifest invalide.");
  }

  for (const game of data.games) {
    if (
      !game?.id ||
      !game?.name ||
      !game?.version ||
      !game?.downloadUrl ||
      !game?.sha256 ||
      !game?.exe ||
      !game?.cover
    ) {
      throw new Error("Entrée jeu invalide dans le manifest.");
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(game.id)) {
      throw new Error(`ID jeu invalide: ${game.id}`);
    }

    if (game.exe.includes("..")) {
      throw new Error(`Chemin exe invalide pour ${game.id}`);
    }

    if (!isAllowedGamesDownloadUrl(game.downloadUrl)) {
      throw new Error(`URL de téléchargement non autorisée pour ${game.id}`);
    }

    if (!isAllowedCoverUrl(game.cover)) {
      throw new Error(`URL de cover non autorisée pour ${game.id}`);
    }

    if (!isValidSha256(game.sha256)) {
      throw new Error(`SHA256 invalide pour ${game.id}`);
    }
  }

  return data;
}

function validatePatchNotes(data: PatchNotesData): PatchNotesData {
  if (!data || !Array.isArray(data.patches)) {
    throw new Error("Patch notes invalides.");
  }

  return data;
}

function validateNews(data: NewsData): NewsData {
  if (!data || !Array.isArray(data.news)) {
    throw new Error("News invalides.");
  }

  return data;
}

export async function getManifest(): Promise<ManifestData> {
  const data = await invoke<ManifestData>("get_manifest");
  return validateManifest(data);
}

export async function getPatchNotes(): Promise<PatchNotesData> {
  const data = await invoke<PatchNotesData>("get_patch_notes");
  return validatePatchNotes(data);
}

export async function getNews(): Promise<NewsData> {
  const data = await invoke<NewsData>("get_news");
  return validateNews(data);
}