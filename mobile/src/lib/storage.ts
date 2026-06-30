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

// Ask the backend (sharp) to downscale + recompress a base64 image. Reliable
// across platforms and avoids the native image-manipulator/blob issues on iOS.
// Returns resized JPEG bytes, or the decoded original if resize is unavailable.
async function resizeBase64(base64: string): Promise<Uint8Array> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/resize-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, maxWidth: MAX_WIDTH, quality: QUALITY }),
    });
    if (res.ok) {
      const data = await res.json();
      return new Uint8Array(decode(data.base64));
    }
  } catch {
    /* fall back to original below */
  }
  return new Uint8Array(decode(base64));
}

async function putBytes(bytes: Uint8Array, userId: string, folder?: string): Promise<string | undefined> {
  const prefix = folder ? `${userId}/${folder}` : userId;
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Upload an image we already hold as base64 (e.g. straight from the image
// picker). Avoids reading the uri with the File API, which can't handle the
// ph:// URIs the picker returns when base64 is requested.
export async function uploadBase64Image(
  base64: string | undefined,
  userId: string,
  folder?: string,
): Promise<string | undefined> {
  if (!base64 || !isSupabaseConfigured) return undefined;
  try {
    const bytes = await resizeBase64(base64);
    return await putBytes(bytes, userId, folder);
  } catch (e: any) {
    console.error('[storage] base64 upload FAILED', e?.message, e?.statusCode, e?.error);
    return undefined;
  }
}

// True if the URL already lives in our own Supabase bucket — no need to
// re-upload an image we already host.
function isOwnStorageUrl(uri: string): boolean {
  return uri.includes(`/${BUCKET}/`);
}

// Persist a recipe cover to Supabase Storage and return its permanent public
// URL. Handles three cases:
//   • local file/picker URIs (file:, content:, ph:…) → read + upload
//   • remote http(s) URLs (e.g. Instagram/Facebook og:image) → fetch + upload,
//     because those CDN links are signed and EXPIRE after hours/days, leaving a
//     blank cover later. Re-hosting them makes covers permanent.
//   • already-hosted Supabase URLs and empty values → pass through unchanged.
export async function uploadImageIfLocal(
  uri: string | undefined,
  userId: string,
  folder?: string,
): Promise<string | undefined> {
  if (!uri) return uri;
  if (!isSupabaseConfigured) return uri; // offline / not configured → keep uri
  if (isOwnStorageUrl(uri)) return uri; // already permanent in our bucket

  try {
    let base64: string;
    if (isLocalUri(uri)) {
      // Read the local file as raw bytes (Expo SDK 54 filesystem API).
      const original = await new File(uri).bytes();
      base64 = encode(original.buffer as ArrayBuffer);
    } else {
      // Remote URL — download it before it expires, then re-host it.
      const res = await fetch(uri);
      if (!res.ok) return uri; // unreachable → keep the original link
      const ab = await res.arrayBuffer();
      base64 = encode(ab);
    }
    const bytes = await resizeBase64(base64);
    return (await putBytes(bytes, userId, folder)) ?? uri;
  } catch (e: any) {
    console.error('[storage] upload FAILED', e?.message, e?.statusCode, e?.error, e?.status);
    return uri; // on any failure keep the original so we don't lose the cover
  }
}
