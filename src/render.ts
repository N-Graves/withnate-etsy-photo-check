import { safeArea, type Rect } from "./plan.js";

export const decode = async (file: File): Promise<ImageBitmap> =>
  createImageBitmap(file, { imageOrientation: "from-image" });

const canvasOf = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

const ctx2d = (c: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("This browser would not give us a 2D canvas to draw on.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
};

/** The crop as a buyer would see it, small, with the 10% safe margin dashed in. */
export const previewCrop = (source: ImageBitmap, rect: Rect, maxWidth: number): HTMLCanvasElement => {
  const scale = Math.min(1, maxWidth / rect.width);
  const w = Math.max(1, Math.round(rect.width * scale));
  const hgt = Math.max(1, Math.round(rect.height * scale));
  const c = canvasOf(w, hgt);
  const ctx = ctx2d(c);
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, w, hgt);
  const safe = safeArea({ x: 0, y: 0, width: w, height: hgt });
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.strokeRect(safe.x, safe.y, safe.width, safe.height);
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineDashOffset = 5;
  ctx.strokeRect(safe.x, safe.y, safe.width, safe.height);
  return c;
};

/** The crop at full resolution as a JPEG, for upload. */
export const cropToJpeg = (source: ImageBitmap, rect: Rect): Promise<Blob> => {
  const c = canvasOf(rect.width, rect.height);
  const ctx = ctx2d(c);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("The browser could not save that image."))), "image/jpeg", 0.92),
  );
};
