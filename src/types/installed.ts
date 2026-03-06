export interface InstalledGameEntry {
  installed_version: string;
  install_dir: string;
  exe_relative_path: string;
}

export type InstalledGamesMap = Record<string, InstalledGameEntry>;

export type GameInstallState =
  | "not_installed"
  | "installed"
  | "update_available";