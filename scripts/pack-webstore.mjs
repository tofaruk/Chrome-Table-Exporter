import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import archiver from "archiver";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "webstore");
const ZIP_PATH = path.join(OUT_DIR, "chrome-table-exporter.zip");

const REQUIRED = [
  "manifest.json",
  "styles.css",
  "dist/content.js",
  "dist/background.js",
  "icons/icon16.png",
  "icons/icon48.png",
  "icons/icon128.png",
];

// Verify required files exist
for (const rel of REQUIRED) {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    console.error(`❌ Missing required file: ${rel}`);
    process.exit(1);
  }
}

// Optional: include any runtime assets your code loads (e.g., _locales/**, images/**)
const OPTIONAL_PATTERNS = [
  "_locales/**",
  "images/**",
  // add more patterns if your extension references them at runtime
];

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const output = fs.createWriteStream(ZIP_PATH);
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", () => {
  console.log(`✅ Packed ${archive.pointer()} bytes -> ${ZIP_PATH}`);
});
archive.on("warning", (err) => {
  if (err.code === "ENOENT") console.warn(err);
  else throw err;
});
archive.on("error", (err) => { throw err; });

archive.pipe(output);

// Add required files at the root of the zip
for (const rel of REQUIRED) {
  archive.file(path.join(ROOT, rel), { name: rel });
}

// Add optional globs
const optionalFiles = await fg(OPTIONAL_PATTERNS, { dot: false });
for (const rel of optionalFiles) {
  archive.file(path.join(ROOT, rel), { name: rel });
}

await archive.finalize();
