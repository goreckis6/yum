import { File } from 'expo-file-system';
import { decode, encode } from 'base64-arraybuffer';
import { supabase, isSupabaseConfigured } from './supabase';
import { getApiBaseUrl } from '../config/api';

const BUCKET = 'recipe-images';
const MAX_WIDTH = 1080;
const QUALITY = 70;

function isLocalUri(uri: string): boolean {
  return /^(file:|content:|ph:|assets-library:)/i.test(uri);
}

// Ask the backend (sharp) to downscale + recompress the image. Reliable across
// platforms and avoids the native image-manipulator blob issues on iOS.
// Returns resized JPEG bytes, or the original bytes if the resize is unavailable.
async function resizeViaBackend(bytes: Uint8Array): Promise<{ bytes: Uint8Array; contentType: string; ext: string }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/resize-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64: encode(bytes.buffer as ArrayBuffer), maxWidth: MAX_WIDTH, quality: QUALITY }),
    });
    if (res.ok) {
      const data = await res.json();
      return { bytes: new Uint8Array(decode(data.base64)), contentType: 'image/jpeg', ext: 'jpg' };
    }
  } catch {
    /* fall back to original below */
  }
  return { bytes, contentType: 'image/jpeg', ext: 'jpg' };
}

// Upload a local image to Supabase Storage and return its public URL. Remote
// URLs (already http...) and empty values pass through unchanged, so this is
// safe to call on every save.
export async function uploadImageIfLocal(
  uri: string | undefined,
  userId: string,
  folder?: string,
): Promise<string | undefined> {
  if (!uri || !isLocalUri(uri)) return uri;
  if (!isSupabaseConfigured) return uri; // offline / not configured → keep local uri

  try {
    // Read the local file as raw bytes (Expo SDK 54 filesystem API).
    const original = await new File(uri).bytes();
    const { bytes, contentType, ext } = await resizeViaBackend(original);

    const prefix = folder ? `${userId}/${folder}` : userId;
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType,
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
