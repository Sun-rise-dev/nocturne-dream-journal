/**
 * Nocturne Icon Generator
 * Uses sharp (librsvg) to properly render SVG to PNG at all required sizes.
 * Unlike Canvas-based conversion, sharp renders SVG filters (feGaussianBlur, feMerge) correctly.
 * Generates both PWA icons (root) and iOS AppIcon assets (Nocturne/Assets.xcassets/).
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SVG_192 = path.join(ROOT, 'icon-192.svg');
const SVG_512 = path.join(ROOT, 'icon-512.svg');
const IOS_DIR = path.join(ROOT, 'Nocturne', 'Assets.xcassets', 'AppIcon.appiconset');

async function renderSvg(svgPath, size) {
  const svgBuffer = fs.readFileSync(svgPath);
  return sharp(svgBuffer).resize(size, size).png().toBuffer();
}

async function generate() {
  // ── PWA icons ──
  console.log('=== PWA Icons ===');
  const pwaSizes = [
    { name: 'icon-192.png', svg: SVG_192, size: 192, dir: ROOT },
    { name: 'icon-512.png', svg: SVG_512, size: 512, dir: ROOT },
  ];

  for (const { name, svg, size, dir } of pwaSizes) {
    const svgBuffer = fs.readFileSync(svg);
    await sharp(svgBuffer).resize(size, size).png().toFile(path.join(dir, name));
    const stat = fs.statSync(path.join(dir, name));
    console.log(`  ${name}: ${stat.size} bytes (${size}×${size})`);
  }

  // Maskable: 75% icon centered on full canvas
  console.log('  icon-maskable.png (maskable)...');
  const innerSize = Math.round(512 * 0.75);
  const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <rect width="512" height="512" fill="#060D18"/>
    <g transform="translate(${Math.round((512 - innerSize) / 2)}, ${Math.round((512 - innerSize) / 2)})">
      <g transform="scale(${(innerSize / 512).toFixed(4)})">
        ${fs.readFileSync(SVG_512, 'utf-8').replace(/<svg[^>]*>/, '').replace('</svg>', '')}
      </g>
    </g>
  </svg>`;
  await sharp(Buffer.from(maskableSvg)).resize(512, 512).png()
    .toFile(path.join(ROOT, 'icon-maskable.png'));
  const ms = fs.statSync(path.join(ROOT, 'icon-maskable.png'));
  console.log(`  icon-maskable.png: ${ms.size} bytes (512×512)`);

  // ── iOS App Icons ──
  console.log('\n=== iOS App Icons ===');
  const iosSizes = [
    { name: 'icon-20@2x.png', size: 40 },
    { name: 'icon-20@3x.png', size: 60 },
    { name: 'icon-29@2x.png', size: 58 },
    { name: 'icon-29@3x.png', size: 87 },
    { name: 'icon-40@2x.png', size: 80 },
    { name: 'icon-40@3x.png', size: 120 },
    { name: 'icon-60@2x.png', size: 120 },
    { name: 'icon-60@3x.png', size: 180 },
    { name: 'icon-76@1x.png', size: 76 },
    { name: 'icon-76@2x.png', size: 152 },
    { name: 'icon-83.5@2x.png', size: 167 },
    { name: 'icon-1024@1x.png', size: 1024 },
  ];

  for (const { name, size } of iosSizes) {
    const svgBuffer = fs.readFileSync(SVG_512);
    await sharp(svgBuffer).resize(size, size).png().toFile(path.join(IOS_DIR, name));
    const stat = fs.statSync(path.join(IOS_DIR, name));
    console.log(`  ${name}: ${stat.size} bytes (${size}×${size})`);
  }

  console.log('\n✅ All icons generated successfully.');
}

generate().catch(err => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
