// Extract image / audio assets from a HAR file
const fs = require('fs');
const path = require('path');

const HAR_PATH = 'C:/Users/honza/Downloads/sazka.fennicagaming.com.har';
const OUT_DIR = path.join(__dirname, 'assets');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

console.log('Reading HAR…');
const har = JSON.parse(fs.readFileSync(HAR_PATH, 'utf8'));
const entries = har.log.entries;
console.log(`Total entries: ${entries.length}`);

const summary = [];

function safeName(url) {
  try {
    const u = new URL(url);
    let name = path.basename(u.pathname);
    if (!name || name === '/' || name === '') {
      name = u.hostname + u.pathname.replace(/\W+/g, '_');
    }
    return name;
  } catch (e) {
    return url.replace(/\W+/g, '_').slice(-80);
  }
}

let imgCount = 0;
let other = {};
const imageMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/gif', 'image/avif'];
const audioMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];

for (const e of entries) {
  const url = e.request.url;
  const mime = (e.response.content && e.response.content.mimeType || '').split(';')[0].toLowerCase();
  const isImage = imageMimes.some(m => mime.startsWith(m));
  const isAudio = audioMimes.some(m => mime.startsWith(m));
  if (!isImage && !isAudio) {
    other[mime] = (other[mime] || 0) + 1;
    continue;
  }
  const text = e.response.content.text;
  if (!text) {
    summary.push({ url, mime, status: 'no-body' });
    continue;
  }
  const isBase64 = e.response.content.encoding === 'base64';
  const buf = isBase64 ? Buffer.from(text, 'base64') : Buffer.from(text, 'utf8');

  let name = safeName(url);
  // Ensure correct extension based on mime
  const extMap = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg',
                   'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/gif': '.gif', 'image/avif': '.avif',
                   'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/ogg': '.ogg' };
  const wantExt = extMap[mime] || '';
  if (wantExt && !name.toLowerCase().endsWith(wantExt)) name = name + wantExt;
  // Avoid clobbering — append size if a name collides with different content
  let outPath = path.join(OUT_DIR, name);
  if (fs.existsSync(outPath)) {
    const existing = fs.readFileSync(outPath);
    if (existing.length === buf.length) {
      // Already present, skip
      summary.push({ url, mime, name, size: buf.length, status: 'dup' });
      continue;
    }
    const base = path.basename(name, path.extname(name));
    const ext  = path.extname(name);
    let i = 2;
    while (fs.existsSync(path.join(OUT_DIR, `${base}_${i}${ext}`))) i++;
    name = `${base}_${i}${ext}`;
    outPath = path.join(OUT_DIR, name);
  }
  fs.writeFileSync(outPath, buf);
  summary.push({ url, mime, name, size: buf.length, status: 'saved' });
  if (isImage) imgCount++;
}

console.log(`Saved images/audio: ${summary.filter(s => s.status === 'saved').length}`);
console.log(`Image entries: ${imgCount}`);
console.log('Other mime types found (top 10):');
const sorted = Object.entries(other).sort((a, b) => b[1] - a[1]).slice(0, 10);
for (const [m, c] of sorted) console.log(`  ${m}: ${c}`);

fs.writeFileSync(path.join(__dirname, 'assets-manifest.json'), JSON.stringify(summary, null, 2));
console.log('Manifest written.');
