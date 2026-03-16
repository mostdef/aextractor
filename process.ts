import { execFile } from "child_process";
import { promisify } from "util";
import { readdir } from "fs/promises";
import path from "path";
import chokidar from "chokidar";

const execFileAsync = promisify(execFile);

const INPUT_DIR = path.resolve("input");
const OUTPUT_DIR = path.resolve("output");
const WATCH_MODE = process.argv.includes("--watch");

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];

function baseName(file: string): string | null {
  const ext = path.extname(file).toLowerCase();
  if (!IMAGE_EXTS.includes(ext)) return null;
  const name = path.basename(file, ext);
  if (name.endsWith("-white") || name.endsWith("-black")) {
    return name.slice(0, -6); // strip "-white" or "-black"
  }
  return null;
}

const processing = new Set<string>();

async function findPairs(): Promise<Map<string, { white: string; black: string }>> {
  const files = await readdir(INPUT_DIR);
  const whites = new Map<string, string>();
  const blacks = new Map<string, string>();

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!IMAGE_EXTS.includes(ext)) continue;
    const name = path.basename(file, ext);
    if (name.endsWith("-white")) whites.set(name.slice(0, -6), file);
    else if (name.endsWith("-black")) blacks.set(name.slice(0, -6), file);
  }

  const pairs = new Map<string, { white: string; black: string }>();
  for (const [base, white] of whites) {
    if (blacks.has(base)) pairs.set(base, { white, black: blacks.get(base)! });
  }
  return pairs;
}

async function processPair(base: string, white: string, black: string) {
  if (processing.has(base)) return;
  processing.add(base);

  const whitePath = path.join(INPUT_DIR, white);
  const blackPath = path.join(INPUT_DIR, black);
  const outputPath = path.join(OUTPUT_DIR, `${base}.png`);

  console.log(`Processing: ${base}`);
  try {
    await execFileAsync("npx", [
      "tsx",
      path.resolve("extract_alpha.ts"),
      whitePath,
      blackPath,
      outputPath,
    ]);
    console.log(`Done: output/${base}.png`);
  } catch (err) {
    console.error(`Failed: ${base}`, err);
  } finally {
    processing.delete(base);
  }
}

async function processAll() {
  const pairs = await findPairs();
  if (pairs.size === 0) {
    console.log("No pairs found in input/");
    return;
  }
  await Promise.all(
    [...pairs.entries()].map(([base, { white, black }]) =>
      processPair(base, white, black)
    )
  );
}

if (WATCH_MODE) {
  console.log(`Watching ${INPUT_DIR} for image pairs...`);
  // Process existing pairs on startup
  await processAll();

  chokidar.watch(INPUT_DIR, { ignoreInitial: true }).on("add", async (filePath) => {
    const file = path.basename(filePath);
    const base = baseName(file);
    if (!base) return;
    // Give both files a moment to land before processing
    setTimeout(async () => {
      const pairs = await findPairs();
      const pair = pairs.get(base);
      if (pair) await processPair(base, pair.white, pair.black);
    }, 500);
  });
} else {
  await processAll();
}
