/**
 * Remove Supabase Auth tokens for the retired project before any module creates the client.
 * Prefix is base64 so production bundles do not contain the old project ref when searching chunks.
 */
const LEGACY_STORAGE_PREFIX = atob("c2ItbXFndHZmaGRwb2t0Z3NlcG5meGk=");

try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(LEGACY_STORAGE_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
} catch {
  /* ignore (private mode, SSR) */
}
