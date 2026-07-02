'use strict';

/* Ebook file storage on Supabase Storage (a private bucket). The DB only holds
   a pointer (BookAsset.storageKey); the bytes live here. Downloads are served
   as short-lived signed URLs so the bucket never needs to be public.

   Configure with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (+ optional
   EBOOK_BUCKET). With those unset the feature degrades gracefully: uploads and
   downloads return a clear "not configured" error and the rest of the app runs. */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.EBOOK_BUCKET || 'ebooks';

let client = null;

export function storageReady() {
  return Boolean(URL && KEY);
}

function getClient() {
  if (!storageReady()) throw new Error('Storage is not configured.');
  if (!client) {
    client = createClient(URL, KEY, { auth: { persistSession: false } });
  }
  return client;
}

export async function uploadEbook(key, buffer, contentType) {
  const { error } = await getClient().storage.from(BUCKET).upload(key, buffer, { contentType, upsert: true });
  if (error) throw error;
  return key;
}

export async function signedUrl(key, expiresIn = 60) {
  const { data, error } = await getClient().storage.from(BUCKET).createSignedUrl(key, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeEbook(key) {
  const { error } = await getClient().storage.from(BUCKET).remove([key]);
  if (error) throw error;
}

export default { storageReady, uploadEbook, signedUrl, removeEbook };
