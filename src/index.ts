import { attachIntake, formatBytes, h, measureImage, mount, readHeaderBytes } from "@nasdigitaluk/withnate-tool-core";
import { cropToJpeg, decode, previewCrop } from "./render.js";
import {
  CROPS,
  MAX_MEGAPIXELS,
  RECOMMENDED_SHORT_EDGE,
  cropById,
  cropRect,
  gradeSize,
  isLargeFile,
  isTooLarge,
  lostFraction,
  megapixels,
  suggestedName,
} from "./plan.js";

const q = <T extends HTMLElement>(root: HTMLElement, sel: string): T | null => root.querySelector<T>(sel);

const VERDICT = {
  good: "Big enough. Buyers can zoom in and it will stay sharp.",
  ok: "Usable, but on the small side. Zooming in will look soft.",
  small: "Too small for a good listing photo. It will look blurry when buyers zoom.",
} as const;

mount("[data-ep]", ({ root }) => {
  const drop = q<HTMLElement>(root, "[data-ep-drop]");
  if (!drop) return;
  const statusOut = q<HTMLElement>(root, "[data-ep-status]");
  const summary = q<HTMLElement>(root, "[data-ep-summary]");
  const controls = q<HTMLElement>(root, "[data-ep-controls]");
  const focusX = q<HTMLInputElement>(root, "[data-ep-focus-x]");
  const focusY = q<HTMLInputElement>(root, "[data-ep-focus-y]");
  const crops = q<HTMLElement>(root, "[data-ep-crops]");
  const download = q<HTMLAnchorElement>(root, "[data-ep-download]");
  const resetBtn = q<HTMLButtonElement>(root, "[data-ep-reset]");

  let bitmap: ImageBitmap | null = null;
  let file: File | null = null;
  let url: string | null = null;
  let request = 0;
  let debounce = 0;

  const setStatus = (text: string, kind: "info" | "error" | "" = ""): void => {
    if (!statusOut) return;
    statusOut.textContent = text;
    statusOut.className = kind ? `ep-status is-${kind}` : "ep-status";
    statusOut.hidden = text.length === 0;
  };

  const release = (): void => {
    if (url) URL.revokeObjectURL(url);
    url = null;
  };

  const show = (on: boolean): void => {
    if (controls) controls.hidden = !on;
    if (resetBtn) resetBtn.hidden = !on;
    if (download) download.hidden = !on;
    if (!on) {
      release();
      summary?.replaceChildren();
      crops?.replaceChildren();
    }
  };

  const focus = (): [number, number] => [Number(focusX?.value ?? 50) / 100, Number(focusY?.value ?? 50) / 100];

  const renderCrops = async (): Promise<void> => {
    if (!bitmap || !file) return;
    const ticket = ++request;
    const [fx, fy] = focus();
    const cards = CROPS.map((crop) => {
      const rect = cropRect(bitmap!, crop.w, crop.h, fx, fy);
      const lost = Math.round(lostFraction(bitmap!, rect) * 100);
      return h(
        "figure",
        { class: "ep-crop" },
        previewCrop(bitmap!, rect, 480),
        h(
          "figcaption",
          {},
          h("strong", {}, crop.label),
          h("span", { class: "ep-note" }, crop.note),
          h("span", { class: "ep-note" }, lost > 0 ? `Cuts off ${lost}% of your photo.` : "Uses your whole photo."),
        ),
      );
    });
    crops?.replaceChildren(...cards);

    const upload = cropById("upload");
    if (!upload || !download) return;
    const rect = cropRect(bitmap, upload.w, upload.h, fx, fy);
    const blob = await cropToJpeg(bitmap, rect);
    if (ticket !== request) return;
    release();
    url = URL.createObjectURL(blob);
    download.href = url;
    download.download = suggestedName(file.name, upload);
    download.textContent = `Download the 4:3 crop (${rect.width} × ${rect.height}, ${formatBytes(blob.size)})`;
  };

  const renderSummary = (): void => {
    if (!bitmap || !file || !summary) return;
    const { grade, shortest } = gradeSize(bitmap);
    const lines = [
      h("p", { class: `ep-verdict is-${grade}` }, VERDICT[grade]),
      h(
        "p",
        { class: "ep-note" },
        `${bitmap.width} × ${bitmap.height} pixels. The shortest side is ${shortest}; Etsy recommends at least ${RECOMMENDED_SHORT_EDGE}.`,
      ),
    ];
    if (isLargeFile(file.size)) {
      lines.push(
        h("p", { class: "ep-note" }, `The file is ${formatBytes(file.size)}. Etsy suggests under 1 MB so it uploads faster; the image compressor on this site can shrink it.`),
      );
    }
    summary.replaceChildren(...lines);
  };

  const load = async (next: File): Promise<void> => {
    const ticket = ++request;
    setStatus("Reading…", "info");
    try {
      const measured = measureImage(await readHeaderBytes(next));
      if (measured && isTooLarge(measured)) {
        setStatus(
          `That image is ${Math.round(megapixels(measured))} megapixels (${measured.width} × ${measured.height}). The limit here is ${MAX_MEGAPIXELS}, because opening it would use more memory than a browser tab can spare.`,
          "error",
        );
        show(false);
        return;
      }
      const decoded = await decode(next);
      if (ticket !== request) {
        decoded.close();
        return;
      }
      bitmap?.close();
      bitmap = decoded;
      file = next;
      if (focusX) focusX.value = "50";
      if (focusY) focusY.value = "50";
      setStatus("");
      show(true);
      renderSummary();
      await renderCrops();
    } catch {
      if (ticket !== request) return;
      setStatus("That file could not be read as an image this browser understands.", "error");
      show(false);
    }
  };

  const schedule = (): void => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void renderCrops(), 120);
  };

  attachIntake(drop, {
    onFile: (f) => void load(f),
    onReject: (reason) => setStatus(reason, "error"),
    draggingClass: "is-dragging",
  });
  focusX?.addEventListener("input", schedule);
  focusY?.addEventListener("input", schedule);
  resetBtn?.addEventListener("click", () => {
    request += 1;
    bitmap?.close();
    bitmap = null;
    file = null;
    show(false);
    setStatus("");
  });
  show(false);
});
