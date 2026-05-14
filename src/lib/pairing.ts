import type { MediaAsset } from "@/types";

/**
 * Extract a comparable "slot" token from a filename.
 * Examples:
 *   "1.png"             -> "1"
 *   "10.png"            -> "10"
 *   "3.1.png"           -> "3.1"
 *   "Slide 2.wav"       -> "2"
 *   "Slide1 NEU.wav"    -> "1"
 *   "Slide 3 NEU.wav"   -> "3"
 *   "intro.jpg"         -> "intro"   (falls back to slug)
 */
export function slotToken(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, "").toLowerCase();
  // Strip common prefixes/suffixes
  const cleaned = stem
    .replace(/\bslide\s*/g, "")
    .replace(/\bneu\b/g, "")
    .trim();
  // Match leading number, optionally with one decimal level (e.g. 3.1)
  const m = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (m) return m[1];
  // Fallback: slug
  return cleaned.replace(/[^a-z0-9]+/g, " ").trim();
}

export type PairRow = {
  imageAssetId: string;
  audioAssetId: string | null;
  duration: number;
};

/**
 * Auto-pair images with audios by their slot tokens.
 * Returns one PairRow per image (in numeric order of token, then filename).
 * Audios that don't match any image are NOT added (they remain available
 * for manual reassignment in the table).
 */
export function autoPair(images: MediaAsset[], audios: MediaAsset[]): PairRow[] {
  const audioByToken = new Map<string, MediaAsset>();
  for (const a of audios) {
    const t = slotToken(a.filename);
    if (!audioByToken.has(t)) audioByToken.set(t, a);
  }

  const rows: PairRow[] = images.map((img) => {
    const t = slotToken(img.filename);
    const aud = audioByToken.get(t) ?? null;
    return {
      imageAssetId: img.id,
      audioAssetId: aud?.id ?? null,
      duration: aud?.duration ?? 5,
    };
  });

  // Sort by numeric token where possible, fallback to filename
  rows.sort((ra, rb) => {
    const imgA = images.find((i) => i.id === ra.imageAssetId)!;
    const imgB = images.find((i) => i.id === rb.imageAssetId)!;
    const ta = slotToken(imgA.filename);
    const tb = slotToken(imgB.filename);
    const na = parseFloat(ta);
    const nb = parseFloat(tb);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return imgA.filename.localeCompare(imgB.filename, undefined, { numeric: true });
  });

  return rows;
}
