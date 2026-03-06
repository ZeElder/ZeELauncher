import type { ManifestData } from "../types/manifest";

const MANIFEST_URL =
  "https://raw.githubusercontent.com/ZeElder/zeelauncher-data/refs/heads/main/manifest.json";

async function safeFetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Erreur HTTP ${response.status} sur ${url}`);
  }

  return response.json() as Promise<T>;
}

export async function getManifest(): Promise<ManifestData> {
  return safeFetchJson<ManifestData>(MANIFEST_URL);
}