import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs"];
const INDEX_FILES = ["index.ts", "index.tsx", "index.mts", "index.js", "index.mjs"];

// Node's ESM resolver requires explicit file extensions and refuses directory
// imports, while the TypeScript sources use extensionless specifiers and a few
// directory imports (`@/lib/capability-packs`). Rewrite those to real file URLs
// before delegating to defaultResolve.
function resolveFile(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const extension of EXTENSIONS) {
    if (existsSync(base + extension)) return base + extension;
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const index of INDEX_FILES) {
      const candidate = join(base, index);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function resolveBare(specifier) {
  let current = ROOT;
  for (;;) {
    const candidate = resolveFile(join(current, "node_modules", specifier));
    if (candidate) return candidate;
    const parent = dirname(current.replace(/[\\/]$/, ""));
    if (parent === current || current === dirname(current)) return null;
    current = parent + "/";
  }
}

export async function resolve(specifier, context, defaultResolve) {
  let base = null;
  if (specifier.startsWith("@/")) {
    base = join(ROOT, specifier.slice(2));
  } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[cm]?[jt]sx?$/.test(specifier) && context.parentURL?.startsWith("file:")) {
    base = join(dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (base) {
    const resolved = resolveFile(base);
    if (resolved) return defaultResolve(pathToFileURL(resolved).href, context, defaultResolve);
    return defaultResolve(specifier, context, defaultResolve);
  }
  if (!specifier.startsWith("node:") && !specifier.startsWith("data:") && !specifier.startsWith("file:")) {
    try {
      return await defaultResolve(specifier, context, defaultResolve);
    } catch (error) {
      // Some dependencies (for example `next/server`) ship without an `exports`
      // map, so Node's ESM resolver will not add the `.js` extension that
      // CommonJS resolution would. Retry against the real file on disk.
      const resolved = resolveBare(specifier);
      if (resolved) return defaultResolve(pathToFileURL(resolved).href, context, defaultResolve);
      throw error;
    }
  }
  return defaultResolve(specifier, context, defaultResolve);
}
