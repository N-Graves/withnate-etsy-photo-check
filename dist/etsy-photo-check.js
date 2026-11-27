/*! withnate-etsy-photo-check v0.1.0 - MIT
 * https://github.com/N-Graves/withnate-etsy-photo-check#readme
 * Runs entirely in the browser. No network requests, no storage.
 */
"use strict";
(() => {
  // node_modules/@nasdigitaluk/withnate-tool-core/dist/bytes.js
  var u8 = (b, i) => {
    const v = b[i];
    if (v === void 0)
      throw new RangeError(`byte ${i} is past the end of the buffer`);
    return v;
  };
  var be16 = (b, i) => u8(b, i) << 8 | u8(b, i + 1);
  var le16 = (b, i) => u8(b, i) | u8(b, i + 1) << 8;
  var le24 = (b, i) => u8(b, i) | u8(b, i + 1) << 8 | u8(b, i + 2) << 16;
  var be32 = (b, i) => (u8(b, i) << 24 | u8(b, i + 1) << 16 | u8(b, i + 2) << 8 | u8(b, i + 3)) >>> 0;
  var le32 = (b, i) => (u8(b, i) | u8(b, i + 1) << 8 | u8(b, i + 2) << 16 | u8(b, i + 3) << 24) >>> 0;
  var matchBytes = (b, sig, offset = 0) => {
    if (b.length < offset + sig.length)
      return false;
    for (let i = 0; i < sig.length; i += 1) {
      if (b[offset + i] !== sig[i])
        return false;
    }
    return true;
  };
  var matchAscii = (b, offset, s) => {
    if (b.length < offset + s.length)
      return false;
    for (let i = 0; i < s.length; i += 1) {
      if (b[offset + i] !== s.charCodeAt(i))
        return false;
    }
    return true;
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/sniff.js
  var PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  var JPEG_SIG = [255, 216, 255];
  var GIF87_SIG = [71, 73, 70, 56, 55, 97];
  var GIF89_SIG = [71, 73, 70, 56, 57, 97];
  var RIFF_SIG = [82, 73, 70, 70];
  var WEBP_SIG = [87, 69, 66, 80];
  var HEADER_BYTES = 64 * 1024;
  var sniffFormat = (bytes) => {
    if (matchBytes(bytes, PNG_SIG))
      return "png";
    if (matchBytes(bytes, JPEG_SIG))
      return "jpeg";
    if (matchBytes(bytes, GIF87_SIG) || matchBytes(bytes, GIF89_SIG))
      return "gif";
    if (matchBytes(bytes, RIFF_SIG) && matchBytes(bytes, WEBP_SIG, 8))
      return "webp";
    return null;
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/units.js
  var MM_PER_INCH = 25.4;
  var CM_PER_INCH = MM_PER_INCH / 10;
  var MM_PER_METRE = 1e3;
  var roundTo = (value, dp) => {
    const f = 10 ** dp;
    return Math.round(value * f) / f;
  };
  var formatBytes = (n) => {
    if (!Number.isFinite(n) || n < 0)
      return "\u2014";
    if (n < 1e3)
      return `${Math.round(n)} B`;
    const kb = Math.round(n / 1e3);
    if (kb < 1e3)
      return `${kb} KB`;
    return `${roundTo(n / 1e6, 1)} MB`;
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/exif.js
  var TYPE_SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];
  var MAX_ENTRIES = 4096;
  var MAX_COMPONENTS = 1024;
  var MAX_BLOCK_BYTES = 4 * 1024 * 1024;
  var key = (ifd, tag) => `${ifd}:${tag}`;
  var findTiffBlock = (bytes) => {
    const format = sniffFormat(bytes);
    if (format === "jpeg") {
      let p = 2;
      while (p + 4 <= bytes.length) {
        if (u8(bytes, p) !== 255) {
          p += 1;
          continue;
        }
        const marker = u8(bytes, p + 1);
        if (marker === 216 || marker >= 208 && marker <= 217 || marker === 1) {
          p += 2;
          continue;
        }
        const len = u8(bytes, p + 2) << 8 | u8(bytes, p + 3);
        if (len < 2)
          return null;
        if (marker === 225 && matchAscii(bytes, p + 4, "Exif\0\0")) {
          return bytes.subarray(p + 10, p + 2 + len);
        }
        if (marker === 218)
          return null;
        p = p + 2 + len;
      }
      return null;
    }
    if (format === "png") {
      let p = 8;
      while (p + 8 <= bytes.length) {
        const len = be32(bytes, p);
        if (matchAscii(bytes, p + 4, "eXIf"))
          return bytes.subarray(p + 8, p + 8 + len);
        if (matchAscii(bytes, p + 4, "IDAT") || matchAscii(bytes, p + 4, "IEND"))
          return null;
        p += 12 + len;
      }
      return null;
    }
    if (format === "webp") {
      let p = 12;
      while (p + 8 <= bytes.length) {
        const len = le32(bytes, p + 4);
        if (matchAscii(bytes, p, "EXIF")) {
          const start = matchAscii(bytes, p + 8, "Exif\0\0") ? p + 14 : p + 8;
          return bytes.subarray(start, p + 8 + len);
        }
        p += 8 + len + len % 2;
      }
      return null;
    }
    return null;
  };
  var reader = (b, little) => ({
    u16: (i) => little ? u8(b, i) | u8(b, i + 1) << 8 : u8(b, i) << 8 | u8(b, i + 1),
    u32: (i) => little ? le32(b, i) : be32(b, i),
    i32: (i) => (little ? le32(b, i) : be32(b, i)) | 0,
    byte: (i) => u8(b, i)
  });
  var TEXT = new TextDecoder("utf-8", { fatal: false });
  var decodeAscii = (block, offset, count) => {
    let end = offset;
    const limit = offset + count;
    while (end < limit && block[end] !== 0)
      end += 1;
    return TEXT.decode(block.subarray(offset, end)).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  };
  var readValue = (r, block, type, count, offset) => {
    if (type === 2)
      return decodeAscii(block, offset, count);
    const size = TYPE_SIZE[type];
    const one = (i) => {
      const at = offset + i * size;
      switch (type) {
        case 1:
        case 7:
          return r.byte(at);
        case 3:
          return r.u16(at);
        case 4:
          return r.u32(at);
        case 9:
          return r.i32(at);
        case 5:
          return { numerator: r.u32(at), denominator: r.u32(at + 4) };
        case 10:
          return { numerator: r.i32(at), denominator: r.i32(at + 4) };
        default:
          return 0;
      }
    };
    if (count === 1)
      return one(0);
    const out = [];
    for (let i = 0; i < count; i += 1)
      out.push(one(i));
    return out;
  };
  var IFD_EXIF_POINTER = 34665;
  var IFD_GPS_POINTER = 34853;
  var readIfd = (r, block, start, ifd, entries, seen, depth) => {
    if (depth > 4 || seen.has(start) || start + 2 > block.length)
      return 0;
    seen.add(start);
    const count = r.u16(start);
    let p = start + 2;
    for (let i = 0; i < count; i += 1, p += 12) {
      if (p + 12 > block.length || entries.length >= MAX_ENTRIES)
        break;
      const tag = r.u16(p);
      const type = r.u16(p + 2);
      const n = r.u32(p + 4);
      const size = TYPE_SIZE[type] ?? 0;
      if (size === 0 || n === 0)
        continue;
      const bytesNeeded = size * n;
      const valueAt = bytesNeeded <= 4 ? p + 8 : r.u32(p + 8);
      if (valueAt + bytesNeeded > block.length)
        continue;
      if (tag === IFD_EXIF_POINTER || tag === IFD_GPS_POINTER) {
        const target = bytesNeeded <= 4 ? r.u32(p + 8) : valueAt;
        readIfd(r, block, target, tag === IFD_EXIF_POINTER ? "exif" : "gps", entries, seen, depth + 1);
        continue;
      }
      if (type !== 2 && n > MAX_COMPONENTS)
        continue;
      try {
        entries.push({ tag, ifd, type, count: n, value: readValue(r, block, type, n, valueAt) });
      } catch {
        continue;
      }
    }
    return p + 4 <= block.length ? r.u32(p) : 0;
  };
  var parseExif = (bytes) => {
    try {
      const block = findTiffBlock(bytes);
      if (!block || block.length < 8 || block.length > MAX_BLOCK_BYTES)
        return null;
      const order = block[0] === 73 && block[1] === 73 ? "little" : block[0] === 77 && block[1] === 77 ? "big" : null;
      if (!order)
        return null;
      const r = reader(block, order === "little");
      if (r.u16(2) !== 42)
        return null;
      const entries = [];
      const seen = /* @__PURE__ */ new Set();
      const next = readIfd(r, block, r.u32(4), "image", entries, seen, 0);
      if (next > 0)
        readIfd(r, block, next, "thumbnail", entries, seen, 1);
      const byKey = /* @__PURE__ */ new Map();
      for (const e of entries)
        byKey.set(key(e.ifd, e.tag), e);
      return { byteOrder: order, entries, byKey };
    } catch {
      return null;
    }
  };
  var ratioValue = (v) => {
    if (typeof v === "number")
      return v;
    if (typeof v === "object" && v !== null && "numerator" in v) {
      return v.denominator === 0 ? null : v.numerator / v.denominator;
    }
    return null;
  };
  var exifNumber = (data, ifd, tag) => {
    const e = data.byKey.get(key(ifd, tag));
    return e ? ratioValue(e.value) : null;
  };
  var TAG_X_RESOLUTION = 282;
  var TAG_Y_RESOLUTION = 283;
  var TAG_RESOLUTION_UNIT = 296;
  var exifResolution = (data) => {
    const x = exifNumber(data, "image", TAG_X_RESOLUTION);
    const y = exifNumber(data, "image", TAG_Y_RESOLUTION);
    if (x === null || y === null || x <= 0 || y <= 0)
      return null;
    const unit = exifNumber(data, "image", TAG_RESOLUTION_UNIT) ?? 2;
    if (unit === 2)
      return { x, y };
    if (unit === 3)
      return { x: x * CM_PER_INCH, y: y * CM_PER_INCH };
    return null;
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/dimensions.js
  var measurePng = (b) => {
    const width = be32(b, 16);
    const height = be32(b, 20);
    let density = null;
    let p = 8;
    while (p + 8 <= b.length) {
      const len = be32(b, p);
      const type = p + 4;
      if (matchAscii(b, type, "IDAT") || matchAscii(b, type, "IEND"))
        break;
      if (matchAscii(b, type, "pHYs") && len === 9 && p + 8 + 9 <= b.length) {
        const d = p + 8;
        const perMetreX = be32(b, d);
        const perMetreY = be32(b, d + 4);
        if (u8(b, d + 8) === 1 && perMetreX > 0 && perMetreY > 0) {
          density = {
            x: perMetreX * MM_PER_INCH / MM_PER_METRE,
            y: perMetreY * MM_PER_INCH / MM_PER_METRE,
            source: "png-phys"
          };
        }
        break;
      }
      p += 12 + len;
    }
    return { format: "png", width, height, density };
  };
  var isSof = (m) => m >= 192 && m <= 195 || m >= 197 && m <= 199 || m >= 201 && m <= 203 || m >= 205 && m <= 207;
  var measureJpeg = (b) => {
    let density = null;
    let p = 2;
    while (p + 4 <= b.length) {
      if (u8(b, p) !== 255) {
        p += 1;
        continue;
      }
      const marker = u8(b, p + 1);
      if (marker === 255) {
        p += 1;
        continue;
      }
      if (marker === 216 || marker >= 208 && marker <= 217 || marker === 1) {
        p += 2;
        continue;
      }
      const len = be16(b, p + 2);
      if (len < 2)
        break;
      const payload = p + 4;
      if (isSof(marker)) {
        return { format: "jpeg", height: be16(b, payload + 1), width: be16(b, payload + 3), density };
      }
      if (marker === 224 && matchAscii(b, payload, "JFIF\0")) {
        const units = u8(b, payload + 7);
        const x = be16(b, payload + 8);
        const y = be16(b, payload + 10);
        if (x > 0 && y > 0) {
          if (units === 1)
            density = { x, y, source: "jfif" };
          else if (units === 2) {
            density = { x: x * CM_PER_INCH, y: y * CM_PER_INCH, source: "jfif" };
          }
        }
      }
      if (marker === 218)
        break;
      p = payload + len - 2;
    }
    throw new RangeError("no start-of-frame segment found");
  };
  var measureGif = (b) => ({
    format: "gif",
    width: le16(b, 6),
    height: le16(b, 8),
    density: null
  });
  var measureWebp = (b) => {
    const fourcc = String.fromCharCode(u8(b, 12), u8(b, 13), u8(b, 14), u8(b, 15));
    const data = 20;
    if (fourcc === "VP8X") {
      return {
        format: "webp",
        width: le24(b, data + 4) + 1,
        height: le24(b, data + 7) + 1,
        density: null
      };
    }
    if (fourcc === "VP8 ") {
      return {
        format: "webp",
        width: le16(b, data + 6) & 16383,
        height: le16(b, data + 8) & 16383,
        density: null
      };
    }
    if (fourcc === "VP8L") {
      if (u8(b, data) !== 47)
        throw new RangeError("VP8L signature byte missing");
      const bits = u8(b, data + 1) | u8(b, data + 2) << 8 | u8(b, data + 3) << 16 | u8(b, data + 4) << 24;
      return {
        format: "webp",
        width: (bits & 16383) + 1,
        height: (bits >>> 14 & 16383) + 1,
        density: null
      };
    }
    throw new RangeError(`unrecognised WebP chunk "${fourcc}"`);
  };
  var MEASURERS = {
    png: measurePng,
    jpeg: measureJpeg,
    gif: measureGif,
    webp: measureWebp
  };
  var measureImage = (bytes) => {
    const format = sniffFormat(bytes);
    if (format === null)
      return null;
    try {
      const m = MEASURERS[format](bytes);
      if (!Number.isFinite(m.width) || !Number.isFinite(m.height) || m.width < 1 || m.height < 1) {
        return null;
      }
      if (m.density === null) {
        const exif = parseExif(bytes);
        const res = exif ? exifResolution(exif) : null;
        if (res)
          m.density = { x: res.x, y: res.y, source: "exif" };
      }
      return m;
    } catch {
      return null;
    }
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/intake.js
  var DEFAULT_DRAGGING_CLASS = "is-dragging";
  var attachIntake = (root, opts) => {
    const draggingClass = opts.draggingClass ?? DEFAULT_DRAGGING_CLASS;
    const input = root.querySelector('input[type="file"]');
    const accept = (file) => {
      if (!file)
        return;
      if (opts.maxBytes && file.size > opts.maxBytes) {
        opts.onReject?.(`That file is ${formatBytes(file.size)}. The limit here is ${formatBytes(opts.maxBytes)}.`);
        return;
      }
      if (file.size === 0) {
        opts.onReject?.("That file is empty.");
        return;
      }
      opts.onFile(file);
    };
    const onDragEnter = (e) => {
      e.preventDefault();
      root.classList.add(draggingClass);
    };
    const onDragOver = (e) => {
      e.preventDefault();
      if (e.dataTransfer)
        e.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (e) => {
      if (e.relatedTarget instanceof Node && root.contains(e.relatedTarget))
        return;
      root.classList.remove(draggingClass);
    };
    const onDrop = (e) => {
      e.preventDefault();
      root.classList.remove(draggingClass);
      accept(e.dataTransfer?.files?.[0]);
    };
    const onChange = () => {
      accept(input?.files?.[0]);
      if (input)
        input.value = "";
    };
    const onPaste = (e) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === "file");
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        accept(file);
      }
    };
    root.addEventListener("dragenter", onDragEnter);
    root.addEventListener("dragover", onDragOver);
    root.addEventListener("dragleave", onDragLeave);
    root.addEventListener("drop", onDrop);
    input?.addEventListener("change", onChange);
    document.addEventListener("paste", onPaste);
    return () => {
      root.removeEventListener("dragenter", onDragEnter);
      root.removeEventListener("dragover", onDragOver);
      root.removeEventListener("dragleave", onDragLeave);
      root.removeEventListener("drop", onDrop);
      input?.removeEventListener("change", onChange);
      document.removeEventListener("paste", onPaste);
      root.classList.remove(draggingClass);
    };
  };
  var readHeaderBytes = async (file, n = HEADER_BYTES) => {
    const buf = await file.slice(0, n).arrayBuffer();
    return new Uint8Array(buf);
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/mount.js
  var getWn = () => globalThis.WN ?? null;
  var mount = (selector, init) => {
    const run = () => {
      const root = document.querySelector(selector);
      if (!root)
        return;
      const wn = getWn();
      const reduced = wn?.reduced ?? (typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)").matches : true);
      init({ root, wn, reduced });
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
      run();
    }
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/dom.js
  var h = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v === null || v === void 0)
        continue;
      if (k === "class")
        node.className = String(v);
      else if (v === true)
        node.setAttribute(k, "");
      else
        node.setAttribute(k, String(v));
    }
    for (const c of children) {
      if (c === null || c === void 0)
        continue;
      node.append(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  };

  // src/plan.ts
  var CROPS = [
    { id: "thumb", label: "Search results", note: "About 5:4. Etsy does not publish the exact crop.", w: 5, h: 4 },
    { id: "square", label: "Square views", note: "Some app and shop pages show a square.", w: 1, h: 1 },
    { id: "upload", label: "A safe shape to upload", note: "4:3 landscape, which most guides recommend.", w: 4, h: 3 }
  ];
  var RECOMMENDED_SHORT_EDGE = 2e3;
  var USABLE_SHORT_EDGE = 1e3;
  var SUGGESTED_MAX_BYTES = 1e6;
  var SAFE_MARGIN = 0.1;
  var MAX_MEGAPIXELS = 80;
  var megapixels = (size) => size.width * size.height / 1e6;
  var isTooLarge = (size) => megapixels(size) > MAX_MEGAPIXELS;
  var gradeSize = (size) => {
    const shortest = Math.min(size.width, size.height);
    const grade = shortest >= RECOMMENDED_SHORT_EDGE ? "good" : shortest >= USABLE_SHORT_EDGE ? "ok" : "small";
    return { grade, shortest };
  };
  var isLargeFile = (bytes) => bytes > SUGGESTED_MAX_BYTES;
  var clamp01 = (v) => Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
  var cropRect = (source, w, h2, focusX = 0.5, focusY = 0.5) => {
    const ratio = w / h2;
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
  var lostFraction = (source, rect) => 1 - rect.width * rect.height / (source.width * source.height);
  var safeArea = (rect) => {
    const mx = Math.round(rect.width * SAFE_MARGIN);
    const my = Math.round(rect.height * SAFE_MARGIN);
    return { x: rect.x + mx, y: rect.y + my, width: rect.width - 2 * mx, height: rect.height - 2 * my };
  };
  var suggestedName = (original, crop) => {
    const dot = original.lastIndexOf(".");
    const base = (dot > 0 ? original.slice(0, dot) : original).trim() || "listing-photo";
    return `${base}-etsy-${crop.w}x${crop.h}.jpg`;
  };
  var cropById = (id) => CROPS.find((c) => c.id === id);

  // src/render.ts
  var decode = async (file) => createImageBitmap(file, { imageOrientation: "from-image" });
  var canvasOf = (w, h2) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h2;
    return c;
  };
  var ctx2d = (c) => {
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("This browser would not give us a 2D canvas to draw on.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    return ctx;
  };
  var previewCrop = (source, rect, maxWidth) => {
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
  var cropToJpeg = (source, rect) => {
    const c = canvasOf(rect.width, rect.height);
    const ctx = ctx2d(c);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    return new Promise(
      (resolve, reject) => c.toBlob((b) => b ? resolve(b) : reject(new Error("The browser could not save that image.")), "image/jpeg", 0.92)
    );
  };

  // src/index.ts
  var q = (root, sel) => root.querySelector(sel);
  var VERDICT = {
    good: "Big enough. Buyers can zoom in and it will stay sharp.",
    ok: "Usable, but on the small side. Zooming in will look soft.",
    small: "Too small for a good listing photo. It will look blurry when buyers zoom."
  };
  mount("[data-ep]", ({ root }) => {
    const drop = q(root, "[data-ep-drop]");
    if (!drop) return;
    const statusOut = q(root, "[data-ep-status]");
    const summary = q(root, "[data-ep-summary]");
    const controls = q(root, "[data-ep-controls]");
    const focusX = q(root, "[data-ep-focus-x]");
    const focusY = q(root, "[data-ep-focus-y]");
    const crops = q(root, "[data-ep-crops]");
    const download = q(root, "[data-ep-download]");
    const resetBtn = q(root, "[data-ep-reset]");
    let bitmap = null;
    let file = null;
    let url = null;
    let request = 0;
    let debounce = 0;
    const setStatus = (text, kind = "") => {
      if (!statusOut) return;
      statusOut.textContent = text;
      statusOut.className = kind ? `ep-status is-${kind}` : "ep-status";
      statusOut.hidden = text.length === 0;
    };
    const release = () => {
      if (url) URL.revokeObjectURL(url);
      url = null;
    };
    const show = (on) => {
      if (controls) controls.hidden = !on;
      if (resetBtn) resetBtn.hidden = !on;
      if (download) download.hidden = !on;
      if (!on) {
        release();
        summary?.replaceChildren();
        crops?.replaceChildren();
      }
    };
    const focus = () => [Number(focusX?.value ?? 50) / 100, Number(focusY?.value ?? 50) / 100];
    const renderCrops = async () => {
      if (!bitmap || !file) return;
      const ticket = ++request;
      const [fx, fy] = focus();
      const cards = CROPS.map((crop) => {
        const rect2 = cropRect(bitmap, crop.w, crop.h, fx, fy);
        const lost = Math.round(lostFraction(bitmap, rect2) * 100);
        return h(
          "figure",
          { class: "ep-crop" },
          previewCrop(bitmap, rect2, 480),
          h(
            "figcaption",
            {},
            h("strong", {}, crop.label),
            h("span", { class: "ep-note" }, crop.note),
            h("span", { class: "ep-note" }, lost > 0 ? `Cuts off ${lost}% of your photo.` : "Uses your whole photo.")
          )
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
      download.textContent = `Download the 4:3 crop (${rect.width} \xD7 ${rect.height}, ${formatBytes(blob.size)})`;
    };
    const renderSummary = () => {
      if (!bitmap || !file || !summary) return;
      const { grade, shortest } = gradeSize(bitmap);
      const lines = [
        h("p", { class: `ep-verdict is-${grade}` }, VERDICT[grade]),
        h(
          "p",
          { class: "ep-note" },
          `${bitmap.width} \xD7 ${bitmap.height} pixels. The shortest side is ${shortest}; Etsy recommends at least ${RECOMMENDED_SHORT_EDGE}.`
        )
      ];
      if (isLargeFile(file.size)) {
        lines.push(
          h("p", { class: "ep-note" }, `The file is ${formatBytes(file.size)}. Etsy suggests under 1 MB so it uploads faster; the image compressor on this site can shrink it.`)
        );
      }
      summary.replaceChildren(...lines);
    };
    const load = async (next) => {
      const ticket = ++request;
      setStatus("Reading\u2026", "info");
      try {
        const measured = measureImage(await readHeaderBytes(next));
        if (measured && isTooLarge(measured)) {
          setStatus(
            `That image is ${Math.round(megapixels(measured))} megapixels (${measured.width} \xD7 ${measured.height}). The limit here is ${MAX_MEGAPIXELS}, because opening it would use more memory than a browser tab can spare.`,
            "error"
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
    const schedule = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => void renderCrops(), 120);
    };
    attachIntake(drop, {
      onFile: (f) => void load(f),
      onReject: (reason) => setStatus(reason, "error"),
      draggingClass: "is-dragging"
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
})();
