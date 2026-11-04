import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ROOT } from './lib/config';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#F7F3E9"/>
  <rect x="80" y="80" width="96" height="96" rx="28" fill="#006D41"/>
  <path d="M104 116v28M118 108v44M132 120v20M146 112v36M160 124v12" stroke="#F7F3E9" stroke-width="6" stroke-linecap="round"/>
  <text x="80" y="300" font-family="Nunito, system-ui, sans-serif" font-size="92" font-weight="800" fill="#1F2A24">Awesome Yoto</text>
  <text x="80" y="380" font-family="Nunito, system-ui, sans-serif" font-size="38" font-weight="600" fill="#5A665F">Apps, cards, icons and integrations for the Yoto Player.</text>
  <rect x="80" y="440" width="360" height="10" rx="5" fill="#AF294E"/>
</svg>`;

writeFileSync(join(ROOT, 'site/public/og.svg'), svg);
await sharp(Buffer.from(svg)).png().toFile(join(ROOT, 'site/public/og.png'));
console.log('Generated site/public/og.png');
