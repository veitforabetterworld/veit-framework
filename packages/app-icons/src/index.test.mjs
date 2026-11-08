import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { Resvg } from '@resvg/resvg-js';
import { generateAndroid, generateWeb, loadLogo, monochrome, variants } from './index.mjs';

// Backdrop plus a 40 × 80 bar left of centre.
const LOGO = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect id="background" width="200" height="200" fill="#ff0000"/>
  <rect x="40" y="60" width="40" height="80" fill="#0000ff"/>
</svg>`;

function pngSize(file) {
  const b = fs.readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

function pixel(svg, x, y) {
  const img = new Resvg(svg).render();
  const i = (y * img.width + x) * 4;
  return Array.from(img.pixels.subarray(i, i + 4));
}

describe('app icons', () => {
  it('measures the mark without the backdrop', () => {
    const logo = loadLogo(LOGO);
    const [x, y, w, h] = logo.mark.box;
    assert.ok(Math.abs(x - 40) < 1 && Math.abs(y - 60) < 1, `${x},${y}`);
    assert.ok(Math.abs(w - 40) < 1 && Math.abs(h - 80) < 1, `${w}x${h}`);
    assert.ok(Math.abs(logo.mark.radius - Math.hypot(20, 40)) < 1);
  });

  it('needs a background colour without a backdrop', () => {
    const plain = LOGO.replace(' id="background"', '');
    assert.throws(() => loadLogo(plain.replace('<rect width="200" height="200" fill="#ff0000"/>', '')));
    assert.equal(loadLogo(plain, { background: '#00ff00' }).hasBackground, false);
  });

  it('keeps the mark inside the maskable safe circle on the backdrop', () => {
    const logo = loadLogo(LOGO);
    const svg = variants.maskable(logo, 100);
    assert.deepEqual(pixel(svg, 1, 1), [255, 0, 0, 255]); // backdrop fills the corners
    assert.deepEqual(pixel(svg, 50, 50), [0, 0, 255, 255]); // mark centred
    assert.deepEqual(pixel(svg, 50, 12), [255, 0, 0, 255]); // 38 % from the centre: outside the 36 % circle
  });

  it('makes a white silhouette', () => {
    const img = new Resvg(variants.mark(loadLogo(LOGO), 20)).render();
    const decoded = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><image width="20" height="20" href="data:image/png;base64,${monochrome(img).toString('base64')}"/></svg>`).render();
    const i = (10 * 20 + 10) * 4;
    assert.deepEqual(Array.from(decoded.pixels.subarray(i, i + 4)), [255, 255, 255, 255]);
  });

  it('writes web and Android files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-icons-'));
    try {
      const logo = loadLogo(LOGO);
      const web = generateWeb(logo, { out: path.join(dir, 'web'), icon: 'mark' }, { fill: 0.9 });
      assert.equal(web.length, 9);
      assert.deepEqual(pngSize(path.join(dir, 'web', 'icon-512-maskable.png')), [512, 512]);
      assert.deepEqual(pngSize(path.join(dir, 'web', 'apple-touch-icon.png')), [180, 180]);
      const android = generateAndroid(
        logo,
        { res: path.join(dir, 'res'), storeIcon: path.join(dir, 'store.png'), splash: 'full' },
        { fill: 0.9, monochrome: { themed: 'alpha', notification: 'alpha' } },
      );
      assert.deepEqual(pngSize(path.join(dir, 'res', 'mipmap-xxxhdpi', 'ic_launcher_foreground.png')), [432, 432]);
      assert.deepEqual(pngSize(path.join(dir, 'res', 'drawable-mdpi', 'ic_notification_icon.png')), [24, 24]);
      assert.ok(fs.readFileSync(path.join(dir, 'res', 'mipmap-anydpi-v26', 'ic_launcher.xml'), 'utf8').includes('<monochrome'));
      assert.equal(android.length, 5 * 6 + 2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
