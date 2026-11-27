/**
 * Every decision the Etsy photo checker makes, as pure functions over numbers.
 * src/render.ts owns the canvas and holds no logic.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Crop {
  id: string;
  label: string;
  note: string;
  w: number;
  h: number;
}

/**
 * Etsy shows listing photos in several shapes and does not publish the exact
 * thumbnail crop. Sellers and Etsy's own announcements put the search grid at
 * about 5:4 landscape; square shows on some app and shop views; 4:3 is the
 * shape most guides recommend uploading. All three are shown, labelled as
 * approximate rather than as a promise.
 */
export const CROPS: readonly Crop[] = [
  { id: "thumb", label: "Search results", note: "About 5:4. Etsy does not publish the exact crop.", w: 5, h: 4 },
  { id: "square", label: "Square views", note: "Some app and shop pages show a square.", w: 1, h: 1 },
  { id: "upload", label: "A safe shape to upload", note: "4:3 landscape, which most guides recommend.", w: 4, h: 3 },
];

/** Etsy recommends at least 2000 px on the shortest side, so buyers can zoom. */
export const RECOMMENDED_SHORT_EDGE = 2000;
export const USABLE_SHORT_EDGE = 1000;
/** Etsy suggests keeping files under 1 MB so they upload faster. */
export const SUGGESTED_MAX_BYTES = 1_000_000;
/** Detail closer than this to a crop edge is at risk of being cut. */
export const SAFE_MARGIN = 0.1;

export const MAX_MEGAPIXELS = 80;
export const megapixels = (size: Size): number => (size.width * size.height) / 1e6;
export const isTooLarge = (size: Size): boolean => megapixels(size) > MAX_MEGAPIXELS;

export type Grade = "good" | "ok" | "small";

export const gradeSize = (size: Size): { grade: Grade; shortest: number } => {
  const shortest = Math.min(size.width, size.height);
  const grade: Grade =
    shortest >= RECOMMENDED_SHORT_EDGE ? "good" : shortest >= USABLE_SHORT_EDGE ? "ok" : "small";
  return { grade, shortest };
};

export const isLargeFile = (bytes: number): boolean => bytes > SUGGESTED_MAX_BYTES;

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);

/**
 * The largest rectangle of ratio w:h that fits inside the source, centred on
 * the focus point (0..1 each way) and pushed back inside the edges.
 */
export const cropRect = (source: Size, w: number, h: number, focusX = 0.5, focusY = 0.5): Rect => {
  const ratio = w / h;
  let width = source.width;
  let height = Math.round(width / ratio);
  if (height > source.height) {
    height = source.height;
    width = Math.round(height * ratio);
  }
  width = Math.max(1, Math.min(width, source.width));
  height = Math.max(1, Math.min(height, source.height));
  const cx = clamp01(focusX) * source.width;
  const cy = clamp01(focusY) * source.height;
  const x = Math.round(Math.min(Math.max(cx - width / 2, 0), source.width - width));
  const y = Math.round(Math.min(Math.max(cy - height / 2, 0), source.height - height));
  return { x, y, width, height };
};

/** Share of the photo, 0..1, that a crop throws away. */
export const lostFraction = (source: Size, rect: Rect): number =>
  1 - (rect.width * rect.height) / (source.width * source.height);

/** The inner rectangle that stays clear of the crop edges by SAFE_MARGIN. */
export const safeArea = (rect: Rect): Rect => {
  const mx = Math.round(rect.width * SAFE_MARGIN);
  const my = Math.round(rect.height * SAFE_MARGIN);
  return { x: rect.x + mx, y: rect.y + my, width: rect.width - 2 * mx, height: rect.height - 2 * my };
};

/** photo.final.png -> photo.final-etsy-4x3.jpg */
export const suggestedName = (original: string, crop: Crop): string => {
  const dot = original.lastIndexOf(".");
  const base = (dot > 0 ? original.slice(0, dot) : original).trim() || "listing-photo";
  return `${base}-etsy-${crop.w}x${crop.h}.jpg`;
};

export const cropById = (id: string): Crop | undefined => CROPS.find((c) => c.id === id);
