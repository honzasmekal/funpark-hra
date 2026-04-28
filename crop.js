// Crop the "full-color" frame from each item sprite
const sharp = require('sharp');
const path = require('path');

// Hand-tuned: { src, label, layout: 'v3'|'h3'|'2rows', pickFrame }
// v3 = 3 vertical frames, h3 = 3 horizontal frames, 2rows = top row decorations / bottom = full color
// Custom crop regions where automatic frame layouts don't work cleanly
const items = [
  { src: 'item_2.webp', out: 'sym_sapphire.webp', layout: 'v3', frame: 2 },
  // single tilted bar in the upper-right region
  // single tilted gold bar (upper-right) — clean isolated subject, cropped tight
  { src: 'item_4.webp', out: 'sym_goldbars.webp', layout: 'custom', region: { left: 320, top: 0, width: 86, height: 92 } },
  // mine cart full color is the TOP frame (cart is at top, faded at bottom)
  { src: 'item_5.webp', out: 'sym_minecart.webp', layout: 'v3', frame: 0 },
  // bottom half has TWO clusters: ghost artifact at x=35–95 + real bucket at x=135–245
  // custom region skips the ghost (starts at x=115) and the floating gold-fragment
  // above the bucket (skip first 12 rows by starting at y=130).  Then rotate +15deg
  // to undo the source's 3D-perspective tilt and present an upright bucket.
  { src: 'item_6.webp', out: 'sym_bucket.webp', layout: 'custom', region: { left: 115, top: 130, width: 140, height: 115 }, rotate: -105 },
  { src: 'item_7.webp', out: 'sym_pouch.webp',    layout: 'h3', frame: 2 },
  { src: 'item_8.webp', out: 'sym_nugget.webp',   layout: 'h3', frame: 2 },
];

(async () => {
  for (const it of items) {
    const src = path.join('assets', it.src);
    const out = path.join('assets', it.out);
    const meta = await sharp(src).metadata();
    let region;
    if (it.layout === 'custom') {
      region = it.region;
    } else if (it.layout === 'v3') {
      const fh = Math.floor(meta.height / 3);
      const top = it.frame * fh;
      region = { left: 0, top, width: meta.width, height: Math.min(fh, meta.height - top) };
    } else if (it.layout === 'h3') {
      const fw = Math.floor(meta.width / 3);
      const left = it.frame * fw;
      region = { left, top: 0, width: Math.min(fw, meta.width - left), height: meta.height };
    } else if (it.layout === '2rows') {
      const fh = Math.floor(meta.height / 2);
      const top = it.frame * fh;
      region = { left: 0, top, width: meta.width, height: Math.min(fh, meta.height - top) };
    }
    console.log(`extracting from ${it.src} ${meta.width}x${meta.height}: `, region, it.rotate ? `rotate=${it.rotate}` : '');
    let pipeline = sharp(src).extract(region);
    if (it.rotate) {
      pipeline = pipeline.rotate(it.rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
    }
    // Write to a temp buffer first, then trim transparent margins (especially after rotation).
    const buf = await pipeline.webp({ quality: 92 }).toBuffer();
    await sharp(buf).trim({ threshold: 5 }).webp({ quality: 92 }).toFile(out);
    const m2 = await sharp(out).metadata();
    console.log(`${it.out}: ${m2.width}×${m2.height} (from ${meta.width}×${meta.height} ${it.layout})`);
  }
})();
