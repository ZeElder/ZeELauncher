export type UserStatus = "En ligne" | "Inactive" | "Hors ligne";

export interface UserProfile {
  username: string;
  avatarUrl: string;
  bannerUrl: string;
  bio: string;
  status: UserStatus;
}