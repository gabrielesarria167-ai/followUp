// Renders icon.svg on a transparent canvas: icon.png (512) and a multi-size icon.ico.
// usage: npm run icons (electron scripts/render-icon.cjs <icon.svg> <out.png> <out.ico>)
const { app, BrowserWindow } = require('electron');
const fs = require('fs');

const [svgPath, pngOut, icoOut] = process.argv.slice(-3);
const SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const svg = fs.readFileSync(svgPath, 'utf8');
  // Drawn into a canvas in the page: keeps the alpha channel and skips the compositor.
  const win = new BrowserWindow({ show: false });
  await win.loadURL('data:text/html,<html><body></body></html>');
  const src = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  const render = async (size) => {
    const url = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = ${size};
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, ${size}, ${size});
        const px = ctx.getImageData(0, 0, ${size}, ${size}).data;
        let bin = '';
        for (let i = 0; i < px.length; i++) bin += String.fromCharCode(px[i]);
        resolve([c.toDataURL('image/png').split(',')[1], btoa(bin)]);
      };
      img.onerror = () => reject(new Error('svg load failed'));
      img.src = ${JSON.stringify(src)};
    })`);
    return { png: Buffer.from(url[0], 'base64'), rgba: Buffer.from(url[1], 'base64') };
  };

  // Classic 32-bit DIB entry: bottom-up BGRA plus an all-zero AND mask (alpha does the masking).
  const dib = (size, rgba) => {
    const header = Buffer.alloc(40);
    header.writeUInt32LE(40, 0); header.writeInt32LE(size, 4); header.writeInt32LE(size * 2, 8);
    header.writeUInt16LE(1, 12); header.writeUInt16LE(32, 14); header.writeUInt32LE(size * size * 4, 20);
    const pixels = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const s = (y * size + x) * 4, d = ((size - 1 - y) * size + x) * 4;
        pixels[d] = rgba[s + 2]; pixels[d + 1] = rgba[s + 1]; pixels[d + 2] = rgba[s]; pixels[d + 3] = rgba[s + 3];
      }
    }
    const mask = Buffer.alloc(Math.ceil(size / 32) * 4 * size);
    return Buffer.concat([header, pixels, mask]);
  };

  fs.writeFileSync(pngOut, (await render(512)).png);

  // Sizes below 256 as DIBs (read by every Windows API), 256 as PNG like the system icons.
  const pngs = [];
  for (const s of SIZES) {
    const r = await render(s);
    pngs.push(s >= 256 ? r.png : dib(s, r.rgba));
  }
  const head = Buffer.alloc(6 + 16 * SIZES.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(SIZES.length, 4);
  let offset = head.length;
  SIZES.forEach((s, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(s >= 256 ? 0 : s, e); head.writeUInt8(s >= 256 ? 0 : s, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(pngs[i].length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += pngs[i].length;
  });
  fs.writeFileSync(icoOut, Buffer.concat([head, ...pngs]));
  app.quit();
}).catch((err) => { console.error(err); app.exit(1); });
