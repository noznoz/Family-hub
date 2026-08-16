// Rasterize the master SVGs into all required PNG icon sizes.
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(root, 'public', 'icons');

const master = await readFile(join(iconsDir, 'icon.svg'));
const maskable = await readFile(join(iconsDir, 'icon-maskable.svg'));

const jobs = [
  ['icon-192.png', master, 192],
  ['icon-256.png', master, 256],
  ['icon-384.png', master, 384],
  ['icon-512.png', master, 512],
  ['apple-touch-icon.png', master, 180],
  ['icon-maskable-192.png', maskable, 192],
  ['icon-maskable-512.png', maskable, 512],
  ['favicon-32.png', master, 32],
  ['favicon-16.png', master, 16],
];

await mkdir(iconsDir, { recursive: true });
for (const [name, svg, size] of jobs) {
  await sharp(svg).resize(size, size).png().toFile(join(iconsDir, name));
  console.log('  ✓', name, `${size}x${size}`);
}

// favicon.ico (32px png is widely accepted; write a png as .ico fallback)
await sharp(master).resize(48, 48).png().toFile(join(root, 'public', 'favicon.ico'));
console.log('  ✓ favicon.ico');
console.log('Icons generated.');
