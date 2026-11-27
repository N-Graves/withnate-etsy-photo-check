# withnate-etsy-photo-check

Drop in an Etsy listing photo and see:

- **Whether it is big enough.** Etsy recommends at least 2000 pixels on the shortest side so buyers
  can zoom without it going soft.
- **How it will be cropped.** Etsy shows the first photo in different shapes in different places and
  does not publish the exact crops. The tool shows the three that matter (about 5:4 in search results,
  square on some views, and 4:3 as a safe shape to upload), each with a dashed line 10% in from the
  edges and how much of the photo it cuts off.
- **A 4:3 version to upload**, cropped where you choose with two sliders, at full resolution.

It also notes when a file is over 1 MB, which Etsy suggests staying under for faster uploads.

**Runs entirely in the browser.** No upload, no network requests, no storage. Built for
[withnate.co.uk](https://withnate.co.uk/tools/etsy-photo-check/) as a drop-in: one IIFE, one
stylesheet, and a demo page.

MIT licensed.

## Honest about what is known

Etsy's thumbnail crop is not a published number. Its own announcements and sellers' measurements put
the search grid at roughly 5:4, and guides disagree on the best shape to upload. The tool labels each
crop as approximate and recommends keeping the important part inside the 10% margin, which survives
all of them.

## Things the code is shaped around

- **The megapixel ceiling is read from the header before decoding**, so an 80 MP+ file is refused
  with its size named before any memory is spent.
- **Phone photos are decoded with `imageOrientation: "from-image"`**, so a sideways EXIF tag cannot
  rotate the crop.
- **Every crop is clamped inside the photo**, whatever the focus sliders say, including out-of-range
  and non-number values.
- **Races:** each re-render takes a ticket, so dragging a slider cannot leave a stale download behind.

## Integration

Mounts on `data-ep`; does nothing without it. Markup is in `src/markup.html` and `demo/index.html`.

| Attribute | Element | Role |
|---|---|---|
| `data-ep` | any | Mount point |
| `data-ep-drop` | any | Drop zone; must contain an `input[type=file]` |
| `data-ep-status` | any | Reading, refusals |
| `data-ep-summary` | any | Size verdict and file-size note |
| `data-ep-controls` | any | Hidden until a photo loads |
| `data-ep-focus-x`, `data-ep-focus-y` | `input[type=range]` 0-100 | Where the crops are centred |
| `data-ep-crops` | any | The three crop previews |
| `data-ep-download` | `a` | The 4:3 crop as a JPEG |
| `data-ep-reset` | `button` | Clears the photo |

## Checks

- `npm test`: 14 tests over `src/plan.ts`.
- `npm run prove`: switches off each of the 9 guards in turn and confirms a test fails. All 9 do.
- `npm run smoke`: no network, no storage, no module syntax, no external URLs, silent with no root
  element, and only `.ep-` classes in the stylesheet.

## Built on

[`@nasdigitaluk/withnate-tool-core`](https://github.com/N-Graves/withnate-tool-core), bundled in.

## Licence

MIT. See [LICENSE](LICENSE).
