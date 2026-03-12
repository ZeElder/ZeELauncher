import { supabase } from "../lib/supabase";
import type { UserStatus } from "../types/profile";

export type FriendRequestStatus = "pending" | "accepted" | "rejected";

export interface ProfileSearchResult {
  id: string;
  email: string;
  username: string;
  tag: string;
  avatar_url: string;
  banner_url: string;
  bio: string;
  status: UserStatus;
}

export interface FriendRequestRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: FriendRequestStatus;
  created_at: string;
}

export interface FriendItem {
  requestId: string;
  userId: string;
  username: string;
  tag: string;
  avatar_url: string;
  status: UserStatus;
  bio: string;
}

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error("Utilisateur non connecté.");

  return data.user.id;
}

export async function searchProfiles(query: string): Promise<ProfileSearchResult[]> {
  const trimmed = query.trim();

  if (!trimmed) return [];

  const myUserId = await getCurrentUserId();

  if (trimmed.includes("#")) {
    const [usernamePart, tagPart] = trimmed.split("#");
    const username = usernamePart.trim();
    const tag = tagPart?.trim();

    if (!username || !tag) return [];

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .eq("tag", tag)
      .neq("id", myUserId)
      .limit(10);

    if (error) throw error;

    return (data ?? []) as ProfileSearchResult[];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("username", `%${trimmed}%`)
    .neq("id", myUserId)
    .limit(10);

  if (error) throw error;

  return (data ?? []) as ProfileSearchResult[];
}

export async function sendFriendRequest(receiverId: string) {
  const senderId = await getCurrentUserId();

  const { data: existing, error: existingError } = await supabase
    .from("friend_requests")
    .select("*")
    .or(
      `and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`
    )
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    throw new Error("Une relation d’ami ou demande existe déjà.");
  }

  const { data, error } = await supabase
    .from("friend_requests")
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;

  return data as FriendRequestRow;
}

export async function getIncomingFriendRequests() {
  const myUserId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("friend_requests")
    .select(`
      id,
      sender_id,
      receiver_id,
      status,
      created_at
    `)
    .eq("receiver_id", myUserId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as FriendRequestRow[];

  const senderIds = rows.map((r) => r.sender_id);

  if (senderIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", senderIds);

  if (profilesError) throw profilesError;

  const profilesMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  return rows.map((row) => {
    const sender = profilesMap.get(row.sender_id);

    return {
      requestId: row.id,
      senderId: row.sender_id,
      username: sender?.username ?? "Inconnu",
      tag: sender?.tag ?? "0000",
      avatar_url: sender?.avatar_url ?? "",
      status: sender?.status ?? "Hors ligne",
      bio: sender?.bio ?? "",
      created_at: row.created_at,
    };
  });
}

export async function acceptFriendRequest(requestId: string) {
  const { data, error } = await supabase
    .from("friend_requests")
    .update({ status: "accepted" })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw error;

  return data as FriendRequestRow;
}

export async function rejectFriendRequest(requestId: string) {
  const { data, error } = await supabase
    .from("friend_requests")
    .update({ status: "rejected" })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw error;

  return data as FriendRequestRow;
}

export async function removeFriendRequestOrFriend(requestId: string) {
  const { error } = await supabase
    .from("friend_requests")
    .delete()
    .eq("id", requestId);

  if (error) throw error;
}

export async function getFriendsList(): Promise<FriendItem[]> {
  const myUserId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("friend_requests")
    .select("*")
    .eq("status", "accepted")
    .or(`sender_id.eq.${myUserId},receiver_id.eq.${myUserId}`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as FriendRequestRow[];

  const otherIds = rows.map((row) =>
    row.sender_id === myUserId ? row.receiver_id : row.sender_id
  );

  if (otherIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", otherIds);

  if (profilesError) throw profilesError;

  const profilesMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  return rows.map((row) => {
    const otherUserId =
      row.sender_id === myUserId ? row.receiver_id : row.sender_id;

    const profile = profilesMap.get(otherUserId);

    return {
      requestId: row.id,
      userId: otherUserId,
      username: profile?.username ?? "Inconnu",
      tag: profile?.tag ?? "0000",
      avatar_url: profile?.avatar_url ?? "",
      status: profile?.status ?? "Hors ligne",
      bio: profile?.bio ?? "",
    };
  });
}