import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');

const targets = [
  { source: 'icon.svg', out: 'icon-192.png', size: 192 },
  { source: 'icon.svg', out: 'icon-512.png', size: 512 },
  { source: 'icon.svg', out: 'apple-touch-icon.png', size: 180 },
  { source: 'icon-maskable.svg', out: 'icon-maskable-512.png', size: 512 },
];

for (const { source, out, size } of targets) {
  const svg = await readFile(join(publicDir, source));
  const png = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain' })
    .png()
    .toBuffer();
  await writeFile(join(publicDir, out), png);
  console.log(`generated ${out} (${size}x${size}, ${png.length} bytes)`);
}
