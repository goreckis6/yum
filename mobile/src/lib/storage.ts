import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase, isSupabaseConfigured } from './supabase';

const BUCKET = 'recipe-images';

function isLocalUri(uri: string): boolean {
  return /^(file:|content:|ph:|assets-library:)/i.test(uri);
}

function extOf(uri: string): string {
  const m = uri.split('?')[0].match(/\.(jpg|jpeg|png|webp|heic)$/i);
  return m ? m[1].toLowerCase() : 'jpg';
}

// Upload a local image to Supabase Storage and return its public URL.
// Remote URLs (already http...) and empty values pass through unchanged, so
// this is safe to call on every save.
export async function uploadImageIfLocal(uri: string | undefined, userId: string): Promise<string | undefined> {
  if (!uri || !isLocalUri(uri)) return uri;
  if (!isSupabaseConfigured) return uri; // offline / not configured → keep local uri

  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const ext = extOf(uri);
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const { error } = await supabase.storage.from(BUCKET).upload(path, decode(base64), {
      contentType,
      upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[storage] image upload failed, keeping local uri', e);
    return uri;
  }
}
