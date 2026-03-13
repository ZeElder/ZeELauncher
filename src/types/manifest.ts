export interface LauncherInfo {
  name: string;
  version: string;
}

export interface GameManifestItem {
  id: string;
  name: string;
  version: string;

  downloadUrl: string;
  sha256: string;

  exe: string;
  size: string;
  description: string;
  cover: string;
}

export interface ManifestData {
  launcher: LauncherInfo;
  games: GameManifestItem[];
  patchNotes: string;
}
