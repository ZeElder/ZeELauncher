import { invoke } from "@tauri-apps/api/core";
import type { UserProfile } from "../types/profile";

export async function getUserProfile(): Promise<UserProfile> {
  return invoke<UserProfile>("get_user_profile");
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  return invoke("save_user_profile", { profile });
}