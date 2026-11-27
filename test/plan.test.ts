import { describe, expect, it } from "vitest";
import {
  CROPS,
  RECOMMENDED_SHORT_EDGE,
  SAFE_MARGIN,
  cropById,
  cropRect,
  gradeSize,
  isLargeFile,
  isTooLarge,
  lostFraction,
  safeArea,
  suggestedName,
  type Size,
} from "../src/plan.js";

const size = (width: number, height: number): Size => ({ width, height });
const SOURCES = [size(4032, 3024), size(3024, 4032), size(3000, 3000), size(6000, 900), size(5, 4000)];

describe("cropRect", () => {
  it("always stays inside the photo, for every crop, source and focus", () => {
    for (const c of CROPS) {
      for (const s of SOURCES) {
        for (const [fx, fy] of [[0, 0], [0.5, 0.5], [1, 1], [-3, 9], [Number.NaN, 0.2]]) {
          const r = cropRect(s, c.w, c.h, fx, fy);
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.y).toBeGreaterThanOrEqual(0);
          expect(r.x + r.width).toBeLessThanOrEqual(s.width);
          expect(r.y + r.height).toBeLessThanOrEqual(s.height);
          expect(r.width).toBeGreaterThanOrEqual(1);
          expect(r.height).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("has the crop's shape, from a tall or a wide photo", () => {
    for (const s of [size(3024, 4032), size(6000, 900)]) {
      const r = cropRect(s, 5, 4);
      expect(Math.abs(r.width / r.height - 5 / 4)).toBeLessThan(0.01);
    }
  });

  it("is as big as it can be, touching one pair of edges", () => {
    const r = cropRect(size(3024, 4032), 5, 4);
    expect(r.width).toBe(3024);
  });

  it("follows the focus point", () => {
    const s = size(3024, 4032);
    expect(cropRect(s, 5, 4, 0.5, 0).y).toBe(0);
    const bottom = cropRect(s, 5, 4, 0.5, 1);
    expect(bottom.y + bottom.height).toBe(s.height);
    const mid = cropRect(s, 5, 4, 0.5, 0.5);
    expect(mid.y).toBe(Math.round((s.height - mid.height) / 2));
  });
});

describe("lostFraction", () => {
  it("is zero when the photo already has the crop's shape", () => {
    const s = size(4000, 3000);
    expect(lostFraction(s, cropRect(s, 4, 3))).toBe(0);
  });
  it("reports what a portrait photo loses to a landscape crop", () => {
    const s = size(3000, 4000);
    expect(lostFraction(s, cropRect(s, 4, 3))).toBeCloseTo(0.4375, 3);
  });
});

describe("gradeSize", () => {
  it("passes Etsy's recommended 2000 px shortest side", () => {
    expect(gradeSize(size(2000, 2500)).grade).toBe("good");
    expect(RECOMMENDED_SHORT_EDGE).toBe(2000);
  });
  it("calls 1999 px usable, not good", () => {
    expect(gradeSize(size(1999, 3000)).grade).toBe("ok");
  });
  it("calls anything under 1000 px too small", () => {
    expect(gradeSize(size(999, 3000)).grade).toBe("small");
  });
  it("measures the shortest side, whichever way round", () => {
    expect(gradeSize(size(5000, 1500)).shortest).toBe(1500);
  });
});

describe("file size and the megapixel ceiling", () => {
  it("flags files over 1 MB", () => {
    expect(isLargeFile(1_000_001)).toBe(true);
    expect(isLargeFile(999_999)).toBe(false);
  });
  it("refuses over 80 MP and passes a 61 MP camera file", () => {
    expect(isTooLarge(size(10000, 9000))).toBe(true);
    expect(isTooLarge(size(9504, 6336))).toBe(false);
  });
});

describe("safeArea", () => {
  it("sits 10% in from every edge", () => {
    const a = safeArea({ x: 0, y: 0, width: 1000, height: 800 });
    expect(SAFE_MARGIN).toBe(0.1);
    expect(a).toEqual({ x: 100, y: 80, width: 800, height: 640 });
  });
});

describe("suggestedName", () => {
  it("names the shape and keeps interior dots", () => {
    expect(suggestedName("mug.final.png", cropById("upload")!)).toBe("mug.final-etsy-4x3.jpg");
    expect(suggestedName("", cropById("upload")!)).toBe("listing-photo-etsy-4x3.jpg");
  });
});
