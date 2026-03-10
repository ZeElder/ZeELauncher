import { supabase } from "../lib/supabase";

export async function uploadAvatar(file: File, userId: string) {
  const path = `${userId}-${Date.now()}-${file.name}`;

  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadBanner(file: File, userId: string) {
  const path = `${userId}-${Date.now()}-${file.name}`;

  const { error } = await supabase.storage.from("banners").upload(path, file, {
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("banners").getPublicUrl(path);
  return data.publicUrl;
}