// Emit pre-compressed siblings (.br / .gz) for the built SPA.
//
// The panel is served by a Go binary that embeds dist/ with go:embed, so the
// bytes are final at build time. Compressing here instead of per request keeps
// the server's single core free and lets us use Brotli quality 11, which is far
// beyond anything affordable at request time.
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const COMPRESSIBLE = new Set([".js", ".css", ".html", ".svg", ".json", ".txt"]);

const root = path.resolve(import.meta.dirname, "..", "dist");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (COMPRESSIBLE.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function brotli(buffer) {
  return brotliCompressSync(buffer, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_SIZE_HINT]: buffer.length,
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
    },
  });
}

const files = await walk(root);
const rows = [];
let before = 0;
let after = 0;

for (const file of files) {
  const raw = await readFile(file);
  const br = brotli(raw);
  const gz = gzipSync(raw, { level: 9 });

  // Only keep a variant when it actually wins; a 615 byte HTML file can grow.
  if (br.length < raw.length) {
    await writeFile(`${file}.br`, br);
  }
  if (gz.length < raw.length) {
    await writeFile(`${file}.gz`, gz);
  }

  before += raw.length;
  after += Math.min(br.length, gz.length);
  rows.push({
    file: path.relative(root, file).replaceAll("\\", "/"),
    raw: raw.length,
    br: br.length,
    gz: gz.length,
  });
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
for (const row of rows) {
  console.log(
    `  ${row.file.padEnd(34)} ${kb(row.raw).padStart(10)} → br ${kb(row.br).padStart(9)} / gz ${kb(row.gz).padStart(9)}`
  );
}
console.log(
  `precompress: ${rows.length} files, ${kb(before)} → ${kb(after)} on the wire`
);
