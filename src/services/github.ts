import { invoke } from "@tauri-apps/api/core";
import type { ManifestData } from "../types/manifest";
import type { PatchNotesData } from "../types/patchnotes";
import type { NewsData } from "../types/news";

export async function getManifest(): Promise<ManifestData> {
  return invoke<ManifestData>("get_manifest");
}

export async function getPatchNotes(): Promise<PatchNotesData> {
  return invoke<PatchNotesData>("get_patch_notes");
}

export async function getNews(): Promise<NewsData> {
  return invoke<NewsData>("get_news");
}