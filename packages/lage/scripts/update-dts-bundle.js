//
// See the comment in ../dts-bundle.config.js for why this is needed.
//

// @ts-check
const fs = require("fs");
const { builtinModules } = require("module");
const path = require("path");
const { findGitRoot } = require("workspace-tools");
const dtsConfig = require("../dts-bundle.config");

const gitRoot = findGitRoot(process.cwd());
const relativeFilename = path.relative(gitRoot, __filename);

let hasError = false;

// Scan through the imports to validate they're only referencing builtins or other bundled packages,
// and rewrite any package imports to point to the local bundle file
const bundlePath = path.resolve(__dirname, "../dist/index.d.ts");
const content = fs.readFileSync(bundlePath, "utf8");
let unexpectedImports = /** @type {string[]} */ ([]);

for (const [fullMatch, importName] of content.matchAll(/from ['"](.*?)['"]/g)) {
  if (!builtinModules.includes(importName)) {
    unexpectedImports.push(importName);
  }
}

if (unexpectedImports.length) {
  hasError = true;
  console.error(`
Found unexpected new import(s) in the bundled types at ${bundlePath}:
${unexpectedImports.map((i) => `  ${i}`).join("\n")}
`);
}

if (hasError) {
  process.exit(1);
}
