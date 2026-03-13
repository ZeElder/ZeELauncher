import { supabase } from "../lib/supabase";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 4096;
const MAX_IMAGE_HEIGHT = 4096;

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

function getFileExtension(file: File) {
  const parts = file.name.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "png";
}

function validateImageFileType(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Format image non autorisé. Utilise PNG, JPG ou WEBP.");
  }
}

function validateImageFileSize(file: File) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Image trop lourde (max 5MB).");
  }
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      URL.revokeObjectURL(objectUrl);
      resolve({ width, height });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossible de lire les dimensions de l’image."));
    };

    image.src = objectUrl;
  });
}

async function validateImageDimensions(file: File) {
  const { width, height } = await readImageDimensions(file);

  if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT) {
    throw new Error(
      `Image trop grande (max ${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT}).`
    );
  }
}

async function validateImageFile(file: File) {
  validateImageFileType(file);
  validateImageFileSize(file);
  await validateImageDimensions(file);
}

export async function uploadAvatar(file: File, userId: string) {
  await validateImageFile(file);

  const ext = getFileExtension(file);
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      upsert: true,
      contentType: file.type || "image/png",
    });

  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadBanner(file: File, userId: string) {
  await validateImageFile(file);

  const ext = getFileExtension(file);
  const path = `${userId}/banner-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("banners")
    .upload(path, file, {
      upsert: true,
      contentType: file.type || "image/png",
    });

  if (error) throw error;

  const { data } = supabase.storage.from("banners").getPublicUrl(path);
  return data.publicUrl;
}