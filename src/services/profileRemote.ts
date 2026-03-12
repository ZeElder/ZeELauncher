import { supabase } from "../lib/supabase";
import type { UserStatus } from "../types/profile";

export interface RemoteProfile {
  id: string;
  email: string;
  username: string;
  tag: string;
  avatar_url: string;
  banner_url: string;
  bio: string;
  status: UserStatus;
}

function generateTag() {
  return String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
}

export async function createProfileIfMissing(user: {
  id: string;
  email?: string;
}) {
  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) {
    console.error("createProfileIfMissing selectError:", selectError);
    throw selectError;
  }

  if (existing) {
    return existing as RemoteProfile;
  }

  const tag = generateTag();

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email ?? "",
      username: "Nouveau joueur",
      tag,
      avatar_url: "",
      banner_url: "",
      bio: "",
      status: "En ligne",
    })
    .select()
    .single();

  if (error) {
    console.error("createProfileIfMissing insertError:", error);
    throw error;
  }

  return data as RemoteProfile;
}

export async function getMyRemoteProfile() {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error("getMyRemoteProfile userError:", userError);
    throw userError;
  }

  if (!userData.user) {
    throw new Error("Utilisateur non connecté.");
  }

  const user = userData.user;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("getMyRemoteProfile selectError:", error);
    throw error;
  }

  if (data) {
    return data as RemoteProfile;
  }

  return createProfileIfMissing({
    id: user.id,
    email: user.email,
  });
}

export async function updateMyRemoteProfile(profile: {
  username: string;
  bio: string;
  status: UserStatus;
  avatar_url: string;
  banner_url: string;
}) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error("updateMyRemoteProfile userError:", userError);
    throw userError;
  }

  if (!userData.user) {
    throw new Error("Utilisateur non connecté.");
  }

  const user = userData.user;

  await createProfileIfMissing({
    id: user.id,
    email: user.email,
  });

  const payload = {
    username: profile.username,
    bio: profile.bio,
    status: profile.status,
    avatar_url: profile.avatar_url,
    banner_url: profile.banner_url,
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    console.error("updateMyRemoteProfile updateError:", error);
    throw error;
  }

  return data as RemoteProfile;
}