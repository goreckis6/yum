import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase, isSupabaseConfigured } from './supabase';

const BUCKET = 'recipe-images';

// Cap stored images so uploads and loads stay fast. 1080px wide is plenty for
// phone covers; JPEG at 0.6 keeps files small with no visible quality loss.
const MAX_WIDTH = 1080;
const COMPRESS = 0.6;

function isLocalUri(uri: string): boolean {
  return /^(file:|content:|ph:|assets-library:)/i.test(uri);
}

// Resize down to MAX_WIDTH (never up) and re-encode as a compressed JPEG.
// Returns the original uri if manipulation fails for any reason.
async function compressImage(uri: string): Promise<string> {
  try {
    const ctx = ImageManipulator.manipulate(uri).resize({ width: MAX_WIDTH });
    const ref = await ctx.renderAsync();
    const result = await ref.saveAsync({ compress: COMPRESS, format: SaveFormat.JPEG });
    return result.uri;
  } catch (e) {
    console.warn('[storage] compress failed, using original', e);
    return uri;
  }
}

// Upload a local image to Supabase Storage and return its public URL.
// Remote URLs (already http...) and empty values pass through unchanged, so
// this is safe to call on every save.
export async function uploadImageIfLocal(
  uri: string | undefined,
  userId: string,
  folder?: string,
): Promise<string | undefined> {
  if (!uri || !isLocalUri(uri)) return uri;
  if (!isSupabaseConfigured) return uri; // offline / not configured → keep local uri

  try {
    // Compress first; output is always a JPEG so we store it as one.
    const compressed = await compressImage(uri);
    const prefix = folder ? `${userId}/${folder}` : userId;
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

    // Expo SDK 54 filesystem API: read the local file as raw bytes.
    const bytes = await new File(compressed).bytes();

    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (e: any) {
    console.error('[storage] upload FAILED', e?.message, e?.statusCode, e?.error, e?.status);
    return uri;
  }
}
