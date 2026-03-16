import sharp from "sharp";

const [, , whitePath, blackPath, outputPath] = process.argv;

if (!whitePath || !blackPath || !outputPath) {
  console.error(
    "Usage: npx tsx extract_alpha.ts <white-bg.jpg> <black-bg.jpg> <output.png>"
  );
  process.exit(1);
}

const { data: wData, info } = await sharp(whitePath)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { data: bData } = await sharp(blackPath)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height } = info;
const out = Buffer.alloc(width * height * 4);

for (let i = 0; i < width * height; i++) {
  const s = i * 3;
  const d = i * 4;

  const wR = wData[s], wG = wData[s + 1], wB = wData[s + 2];
  const bR = bData[s], bG = bData[s + 1], bB = bData[s + 2];

  // alpha per channel: 1 - (white - black) / 255
  const aR = 1 - (wR - bR) / 255;
  const aG = 1 - (wG - bG) / 255;
  const aB = 1 - (wB - bB) / 255;
  const alpha = Math.max(0, Math.min(1, (aR + aG + aB) / 3));

  if (alpha > 0) {
    out[d]     = Math.round(Math.max(0, Math.min(255, bR / alpha)));
    out[d + 1] = Math.round(Math.max(0, Math.min(255, bG / alpha)));
    out[d + 2] = Math.round(Math.max(0, Math.min(255, bB / alpha)));
  }
  out[d + 3] = Math.round(alpha * 255);
}

await sharp(out, { raw: { width, height, channels: 4 } })
  .png()
  .toFile(outputPath);

console.log(`Saved: ${outputPath}`);
